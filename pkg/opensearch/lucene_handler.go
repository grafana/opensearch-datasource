package opensearch

import (
	"context"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/grafana/opensearch-datasource/pkg/tsdb"
	"github.com/grafana/opensearch-datasource/pkg/utils"
)

const (
	defaultLogsSize   = 500
	defaultTracesSize = 1000
	// defaultTermsSize is the terms aggregation size used when none is configured
	// or "No limit" (size 0) is selected. addTermsAgg and configuredTermsSize must
	// agree on this so the bucket budget matches the request we send.
	defaultTermsSize = 500
)

type luceneHandler struct {
	client     client.Client
	reqQueries []backend.DataQuery
	ms         *client.MultiSearchRequestBuilder
	queries    []*Query
	dsSettings *backend.DataSourceInstanceSettings
}

func newLuceneHandler(client client.Client, queries []backend.DataQuery, dsSettings *backend.DataSourceInstanceSettings) *luceneHandler {
	return &luceneHandler{
		client:     client,
		reqQueries: queries,
		ms:         client.MultiSearch(),
		queries:    make([]*Query, 0),
		dsSettings: dsSettings,
	}
}

func (h *luceneHandler) processQuery(q *Query) error {
	if len(q.BucketAggs) == 0 {
		// If no aggregations, only trace, document, and logs queries are valid
		if q.luceneQueryType != "Traces" {
			if len(q.Metrics) == 0 || (q.Metrics[0].Type != rawDataType && q.Metrics[0].Type != rawDocumentType && q.Metrics[0].Type != logsType) {
				return backend.DownstreamErrorf("invalid query, missing metrics and aggregations")
			}
		}
	}

	fromMs := h.reqQueries[0].TimeRange.From.UnixNano() / int64(time.Millisecond)
	toMs := h.reqQueries[0].TimeRange.To.UnixNano() / int64(time.Millisecond)

	minInterval, err := h.client.GetMinInterval(q.Interval)
	if err != nil {
		return err
	}
	// Only date histograms with an "auto" interval are affected by the bucket
	// budget; when combined with terms aggregations the total bucket count can
	// exceed OpenSearch's search.max_buckets, so pass the terms product along.
	maxBuckets := tsdb.MaxBucketsFrom(h.dsSettings)
	termsProduct := int64(1)
	// The shard count only matters when terms aggregations multiply the buckets, so
	// only look it up for auto date histograms that also group by terms.
	if hasAutoDateHistogram(q.BucketAggs) && hasTermsAgg(q.BucketAggs) {
		termsProduct = termsBucketProduct(q.BucketAggs, h.numberOfShards(q.Index), maxBuckets)
	}
	interval, err := tsdb.CalculateInterval(&h.reqQueries[0].TimeRange, minInterval, termsProduct, maxBuckets)
	if err != nil {
		return backend.DownstreamError(err)
	}

	h.queries = append(h.queries, q)

	b := h.ms.Search(interval)
	if q.Index != "" {
		b.SetIndex(q.Index)
	}
	b.Size(0)

	filters := b.Query().Bool().Filter()
	defaultTimeField := h.client.GetConfiguredFields().TimeField

	if q.luceneQueryType == luceneQueryTypeTraces {
		traceId := getTraceId(q.RawQuery)
		switch q.serviceMapInfo.Type {
		case ServiceMap, Prefetch:
			b.Size(0)
			aggBuilder := b.Agg()
			aggBuilder.ServiceMap()
		case Stats:
			b.SetStatsFilters(toMs, fromMs, traceId, q.serviceMapInfo.Parameters)
			aggBuilder := b.Agg()
			aggBuilder.Stats()
		default:
			limit := utils.StringToIntWithDefaultValue(q.TracesSize, defaultTracesSize)
			if traceId != "" {
				b.Size(limit)
				b.SetTraceSpansFilters(toMs, fromMs, traceId)
			} else {
				b.Size(limit)
				b.SetTraceListFilters(toMs, fromMs, q.RawQuery)
				aggBuilder := b.Agg()
				aggBuilder.TraceList(limit)
			}
		}
		return nil
	}

	filters.AddDateRangeFilter(defaultTimeField, client.DateFormatEpochMS, toMs, fromMs)
	if q.RawQuery != "" && q.luceneQueryType != luceneQueryTypeTraces {
		filters.AddQueryStringFilter(q.RawQuery, true)
	}

	switch q.Metrics[0].Type {
	case rawDocumentType, rawDataType:
		processDocumentQuery(q, b, defaultTimeField)
	case logsType:
		processLogsQuery(q, b, fromMs, toMs, defaultTimeField)
	default:
		processTimeSeriesQuery(q, b, fromMs, toMs, defaultTimeField)
	}
	return nil
}

// termsBucketProduct returns the product of the per-terms bucket estimates of all
// terms bucket aggregations, capped at ceiling to avoid overflow when many large
// terms aggregations are combined. A product at or above ceiling already exceeds
// any usable bucket budget, so returning ceiling is sufficient for the interval
// math. shards is the number of shards the target index has, which drives how many
// term buckets OpenSearch materializes during aggregation (see termsBucketEstimate).
func termsBucketProduct(bucketAggs []*BucketAgg, shards, ceiling int64) int64 {
	var product int64 = 1
	for _, bucketAgg := range bucketAggs {
		if bucketAgg.Type != termsType {
			continue
		}
		product *= termsBucketEstimate(configuredTermsSize(bucketAgg), shards)
		if product >= ceiling {
			return ceiling
		}
	}
	return product
}

// termsBucketEstimate approximates how many term buckets OpenSearch materializes
// for a terms aggregation of the given size. search.max_buckets is enforced on the
// intermediate buckets built during aggregation, not the final pruned tree:
//   - With a single shard results are exact, so the estimate is the requested size.
//   - With multiple shards each shard over-requests shard_size = size*1.5 + 10 terms
//     (OpenSearch's default), and the coordinating node holds those across all shards
//     during reduce, so the peak is shards * shard_size.
//
// This keeps the bucket budget conservative on sharded indices, where a modest terms
// size can still exceed the limit once expanded across shards.
func termsBucketEstimate(size int, shards int64) int64 {
	if shards <= 1 {
		return int64(size)
	}
	shardSize := int64(float64(size)*1.5) + 10
	return shards * shardSize
}

// configuredTermsSize resolves a terms aggregation's effective size using the same
// cascade as addTermsAgg, including the size-0 ("No limit") and invalid-value
// fallbacks to defaultTermsSize. It must mirror addTermsAgg so the budgeted bucket
// count matches the size actually sent to OpenSearch.
func configuredTermsSize(bucketAgg *BucketAgg) int {
	size := defaultTermsSize
	if s, err := bucketAgg.Settings.Get("size").Int(); err == nil {
		size = s
	} else if s, err := bucketAgg.Settings.Get("size").String(); err == nil {
		if n, err := strconv.Atoi(s); err == nil {
			size = n
		}
	}
	if size == 0 {
		size = defaultTermsSize
	}
	return size
}

// hasAutoDateHistogram reports whether any date histogram bucket aggregation uses
// the "auto" interval, which is the only case affected by the bucket budget.
func hasAutoDateHistogram(bucketAggs []*BucketAgg) bool {
	for _, bucketAgg := range bucketAggs {
		if bucketAgg.Type == dateHistType && bucketAgg.Settings.Get("interval").MustString("auto") == "auto" {
			return true
		}
	}
	return false
}

// hasTermsAgg reports whether any bucket aggregation is a terms aggregation, i.e.
// whether the query can multiply the bucket count beyond the date histogram alone.
func hasTermsAgg(bucketAggs []*BucketAgg) bool {
	for _, bucketAgg := range bucketAggs {
		if bucketAgg.Type == termsType {
			return true
		}
	}
	return false
}

func getTraceId(rawQuery string) string {
	trimmed := strings.TrimSpace(rawQuery)
	re := regexp.MustCompile(`traceId:(.+)`)
	matches := re.FindStringSubmatch(trimmed)

	if len(matches) != 2 {
		return ""
	}

	return strings.TrimSpace(matches[1])
}

func processLogsQuery(q *Query, b *client.SearchRequestBuilder, from, to int64, defaultTimeField string) {
	metric := q.Metrics[0]
	b.Sort(descending, defaultTimeField, "boolean")
	b.SetCustomProps(defaultTimeField, "logs")

	sizeString := metric.Settings.Get("size").MustString()
	size, err := strconv.Atoi(sizeString)
	if err != nil {
		size = defaultLogsSize
	}
	b.Size(size)

	// For log query, we use only date histogram aggregation
	aggBuilder := b.Agg()
	defaultBucketAgg := &BucketAgg{
		Type:  dateHistType,
		Field: defaultTimeField,
		ID:    "1",
		Settings: utils.NewJsonFromAny(map[string]interface{}{
			"interval": "auto",
		})}
	defaultBucketAgg.Settings = utils.NewJsonFromAny(
		defaultBucketAgg.generateSettingsForDSL(),
	)
	_ = addDateHistogramAgg(aggBuilder, defaultBucketAgg, from, to, defaultTimeField)
}

func (bucketAgg BucketAgg) generateSettingsForDSL() map[string]interface{} {
	setIntPath(bucketAgg.Settings, "min_doc_count")

	return bucketAgg.Settings.MustMap()
}

func setIntPath(settings *simplejson.Json, path ...string) {
	if stringValue, err := settings.GetPath(path...).String(); err == nil {
		if value, err := strconv.ParseInt(stringValue, 10, 64); err == nil {
			settings.SetPath(path, value)
		}
	}
}

func processDocumentQuery(q *Query, b *client.SearchRequestBuilder, defaultTimeField string) {
	metric := q.Metrics[0]
	order := metric.Settings.Get("order").MustString()
	b.Sort(order, defaultTimeField, "boolean")
	b.Sort(order, "_doc", "")
	b.SetCustomProps(defaultTimeField, "raw_document")
	sizeString := metric.Settings.Get("size").MustString()
	size, err := strconv.Atoi(sizeString)
	if err != nil {
		size = defaultLogsSize
	}
	b.Size(size)
}

func processTimeSeriesQuery(q *Query, b *client.SearchRequestBuilder, fromMs int64, toMs int64, defaultTimeField string) {
	aggBuilder := b.Agg()

	// iterate backwards to create aggregations bottom-down
	for _, bucketAgg := range q.BucketAggs {
		bucketAgg.Settings = utils.NewJsonFromAny(
			bucketAgg.generateSettingsForDSL(),
		)
		switch bucketAgg.Type {
		case dateHistType:
			aggBuilder = addDateHistogramAgg(aggBuilder, bucketAgg, fromMs, toMs, defaultTimeField)
		case histogramType:
			aggBuilder = addHistogramAgg(aggBuilder, bucketAgg)
		case filtersType:
			aggBuilder = addFiltersAgg(aggBuilder, bucketAgg)
		case termsType:
			aggBuilder = addTermsAgg(aggBuilder, bucketAgg, q.Metrics)
		case geohashGridType:
			aggBuilder = addGeoHashGridAgg(aggBuilder, bucketAgg)
		}
	}

	for _, m := range q.Metrics {
		m := m
		if m.Type == countType {
			continue
		}

		if isPipelineAgg(m.Type) {
			if isPipelineAggWithMultipleBucketPaths(m.Type) {
				if len(m.PipelineVariables) > 0 {
					bucketPaths := map[string]interface{}{}
					for name, pipelineAgg := range m.PipelineVariables {
						if _, err := strconv.Atoi(pipelineAgg); err == nil {
							var appliedAgg *MetricAgg
							for _, pipelineMetric := range q.Metrics {
								if pipelineMetric.ID == pipelineAgg {
									appliedAgg = pipelineMetric
									break
								}
							}
							if appliedAgg != nil {
								if appliedAgg.Type == countType {
									bucketPaths[name] = "_count"
								} else {
									bucketPaths[name] = pipelineAgg
								}
							}
						}
					}

					aggBuilder.Pipeline(m.ID, m.Type, bucketPaths, func(a *client.PipelineAggregation) {
						a.Settings = m.Settings.MustMap()
					})
				} else {
					continue
				}
			} else {
				pipelineAggField := getPipelineAggField(m)
				if _, err := strconv.Atoi(pipelineAggField); err == nil {
					var appliedAgg *MetricAgg
					for _, pipelineMetric := range q.Metrics {
						if pipelineMetric.ID == pipelineAggField {
							appliedAgg = pipelineMetric
							break
						}
					}
					if appliedAgg != nil {
						bucketPath := pipelineAggField
						if appliedAgg.Type == countType {
							bucketPath = "_count"
						}

						aggBuilder.Pipeline(m.ID, m.Type, bucketPath, func(a *client.PipelineAggregation) {
							a.Settings = m.Settings.MustMap()
						})
					}
				} else {
					continue
				}
			}
		} else {
			aggBuilder.Metric(m.ID, m.Type, m.Field, func(a *client.MetricAggregation) {
				a.Settings = m.Settings.MustMap()
			})
		}
	}
}

func getPipelineAggField(m *MetricAgg) string {
	// From https://github.com/grafana/grafana/pull/60337
	// In frontend we are using Field as pipelineAggField
	// There might be historical reason why in backend we were using PipelineAggregate as pipelineAggField
	// So for now let's check Field first and then PipelineAggregate to ensure that we are not breaking anything
	// TODO: Investigate, if we can remove check for PipelineAggregate
	pipelineAggField := m.Field

	if pipelineAggField == "" {
		pipelineAggField = m.PipelineAggregate
	}
	return pipelineAggField
}

func (h *luceneHandler) executeQueries(ctx context.Context) (*backend.QueryDataResponse, error) {
	if len(h.queries) == 0 {
		return nil, nil
	}

	errRefID := h.queries[0].RefID
	req, err := h.ms.Build()
	if err != nil {
		return &backend.QueryDataResponse{
			Responses: backend.Responses{
				errRefID: backend.ErrorResponseWithErrorSource(backend.PluginError(err)),
			},
		}, nil
	}

	res, err := h.client.ExecuteMultisearch(ctx, req)
	if err != nil {
		if backend.IsDownstreamHTTPError(err) {
			err = backend.DownstreamError(err)
		}
		return &backend.QueryDataResponse{
			Responses: backend.Responses{
				errRefID: backend.ErrorResponseWithErrorSource(err),
			},
		}, nil
	}

	rp := newResponseParser(res.Responses, h.queries, res.DebugInfo, h.client.GetConfiguredFields(), h.dsSettings)
	return rp.parseResponse()
}

// getParametersFromServiceMapResult extracts the lists of services and operations from the
// response to the Prefetch request. These will be used to build the subsequent Stats request.
func getParametersFromServiceMapResult(smResult *client.SearchResponse) ([]string, []string) {
	services := make([]string, 0)
	operationMap := make(map[string]bool)

	buckets := smResult.Aggregations["service_name"].(map[string]interface{})["buckets"].([]interface{})
	for _, bucket := range buckets {
		service := bucket.(map[string]interface{})

		services = append(services, service["key"].(string))
		targets := service["target_domain"].(map[string]interface{})["buckets"].([]interface{})
		for _, targetDomain := range targets {
			targetResources := targetDomain.(map[string]interface{})["target_resource"].(map[string]interface{})["buckets"].([]interface{})
			for _, targetResource := range targetResources {
				operationMap[targetResource.(map[string]interface{})["key"].(string)] = true
			}
		}
	}

	operations := make([]string, 0, len(operationMap))
	for op := range operationMap {
		operations = append(operations, op)
	}
	// ensure consistent order for the snapshot tests in lucene_service_map_test.go
	sort.Strings(services)
	sort.Strings(operations)

	return services, operations
}

func addDateHistogramAgg(aggBuilder client.AggBuilder, bucketAgg *BucketAgg, timeFrom, timeTo int64, timeField string) client.AggBuilder {
	// If no field is specified, use the time field
	field := bucketAgg.Field
	if field == "" {
		field = timeField
	}
	aggBuilder.DateHistogram(bucketAgg.ID, field, func(a *client.DateHistogramAgg, b client.AggBuilder) {
		a.Interval = bucketAgg.Settings.Get("interval").MustString("auto")
		a.MinDocCount = bucketAgg.Settings.Get("min_doc_count").MustInt(0)
		a.ExtendedBounds = &client.ExtendedBounds{Min: timeFrom, Max: timeTo}
		a.Format = bucketAgg.Settings.Get("format").MustString(client.DateFormatEpochMS)

		if a.Interval == "auto" {
			a.Interval = "$__interval"
		}

		if offset, err := bucketAgg.Settings.Get("offset").String(); err == nil {
			a.Offset = offset
		}

		if missing, err := bucketAgg.Settings.Get("missing").String(); err == nil {
			a.Missing = &missing
		}

		aggBuilder = b
	})

	return aggBuilder
}

func addHistogramAgg(aggBuilder client.AggBuilder, bucketAgg *BucketAgg) client.AggBuilder {
	aggBuilder.Histogram(bucketAgg.ID, bucketAgg.Field, func(a *client.HistogramAgg, b client.AggBuilder) {
		a.Interval = stringToFloatWithDefaultValue(bucketAgg.Settings.Get("interval").MustString(), 1000)
		a.MinDocCount = bucketAgg.Settings.Get("min_doc_count").MustInt(0)

		if missing, err := bucketAgg.Settings.Get("missing").Int(); err == nil {
			a.Missing = &missing
		}

		aggBuilder = b
	})

	return aggBuilder
}

func addTermsAgg(aggBuilder client.AggBuilder, bucketAgg *BucketAgg, metrics []*MetricAgg) client.AggBuilder {
	aggBuilder.Terms(bucketAgg.ID, bucketAgg.Field, func(a *client.TermsAggregation, b client.AggBuilder) {
		if size, err := bucketAgg.Settings.Get("size").Int(); err == nil {
			a.Size = size
		} else if size, err := bucketAgg.Settings.Get("size").String(); err == nil {
			a.Size, err = strconv.Atoi(size)
			if err != nil {
				a.Size = defaultTermsSize
			}
		} else {
			a.Size = defaultTermsSize
		}
		if a.Size == 0 {
			a.Size = defaultTermsSize
		}

		if minDocCount, err := bucketAgg.Settings.Get("min_doc_count").Int(); err == nil {
			a.MinDocCount = &minDocCount
		}
		if missing, err := bucketAgg.Settings.Get("missing").String(); err == nil {
			a.Missing = &missing
		}

		if orderBy, err := bucketAgg.Settings.Get("orderBy").String(); err == nil {
			if a.Order == nil {
				a.Order = make(map[string]interface{})
			}
			/*
			   The format for extended stats and percentiles is {metricId}[bucket_path]
			   for everything else it's just {metricId}, _count, _term, or _key
			*/
			metricIdRegex := regexp.MustCompile(`^(\d+)`)
			metricId := metricIdRegex.FindString(orderBy)

			if len(metricId) > 0 {
				for _, m := range metrics {
					if m.ID == metricId {
						if m.Type == "count" {
							a.Order["_count"] = bucketAgg.Settings.Get("order").MustString("desc")
						} else {
							a.Order[orderBy] = bucketAgg.Settings.Get("order").MustString("desc")
							b.Metric(m.ID, m.Type, m.Field, nil)
						}
						break
					}
				}
			} else {
				a.Order[orderBy] = bucketAgg.Settings.Get("order").MustString("desc")
			}
		}

		if executionHint, err := bucketAgg.Settings.Get("execution_hint").String(); err == nil {
			a.ExecutionHint = &executionHint
		}

		aggBuilder = b
	})

	return aggBuilder
}

func addFiltersAgg(aggBuilder client.AggBuilder, bucketAgg *BucketAgg) client.AggBuilder {
	filters := make(map[string]interface{})
	for _, filter := range bucketAgg.Settings.Get("filters").MustArray() {
		json := utils.NewJsonFromAny(filter)
		query := json.Get("query").MustString()
		label := json.Get("label").MustString()
		if label == "" {
			label = query
		}
		filters[label] = &client.QueryStringFilter{Query: query, AnalyzeWildcard: true}
	}

	if len(filters) > 0 {
		aggBuilder.Filters(bucketAgg.ID, func(a *client.FiltersAggregation, b client.AggBuilder) {
			a.Filters = filters
			aggBuilder = b
		})
	}

	return aggBuilder
}

func addGeoHashGridAgg(aggBuilder client.AggBuilder, bucketAgg *BucketAgg) client.AggBuilder {
	aggBuilder.GeoHashGrid(bucketAgg.ID, bucketAgg.Field, func(a *client.GeoHashGridAggregation, b client.AggBuilder) {
		a.Precision = bucketAgg.Settings.Get("precision").MustString("3")
		aggBuilder = b
	})

	return aggBuilder
}

func stringToFloatWithDefaultValue(valueStr string, defaultValue float64) float64 {
	value, err := strconv.ParseFloat(valueStr, 64)
	if err != nil {
		value = defaultValue
	}
	// <=0 is not a valid value and in this case we default to defaultValue
	if value <= 0 {
		value = defaultValue
	}
	return value
}
