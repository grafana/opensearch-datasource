package opensearch

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/errorsource"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/grafana/opensearch-datasource/pkg/tsdb"
	"github.com/grafana/opensearch-datasource/pkg/utils"
)

const (
	defaultLogsSize   = 500
	defaultTracesSize = 1000
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
			if len(q.Metrics) == 0 || !(q.Metrics[0].Type == rawDataType || q.Metrics[0].Type == rawDocumentType) {
				return fmt.Errorf("invalid query, missing metrics and aggregations")
			}
		}
	}

	fromMs := h.reqQueries[0].TimeRange.From.UnixNano() / int64(time.Millisecond)
	toMs := h.reqQueries[0].TimeRange.To.UnixNano() / int64(time.Millisecond)

	minInterval, err := h.client.GetMinInterval(q.Interval)
	if err != nil {
		return err
	}
	interval := tsdb.CalculateInterval(&h.reqQueries[0].TimeRange, minInterval)

	h.queries = append(h.queries, q)

	b := h.ms.Search(interval)
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

	response := backend.NewQueryDataResponse()
	errRefID := h.queries[0].RefID
	req, err := h.ms.Build()
	if err != nil {
		return errorsource.AddPluginErrorToResponse(errRefID, response, err), nil
	}

	res, err := h.client.ExecuteMultisearch(ctx, req)
	if err != nil {
		if backend.IsDownstreamHTTPError(err) {
			err = errorsource.DownstreamError(err, false)
		}
		return errorsource.AddErrorToResponse(errRefID, response, err), nil
	}

	if res.Status >= 400 {
		errWithSource := errorsource.SourceError(backend.ErrorSourceFromHTTPStatus(res.Status), fmt.Errorf("unexpected status code: %d", res.Status), false)
		return errorsource.AddErrorToResponse(h.queries[0].RefID, response, errWithSource), nil
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
		a.Interval = bucketAgg.Settings.Get("interval").MustInt(1000)
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
				a.Size = 500
			}
		} else {
			a.Size = 500
		}
		if a.Size == 0 {
			a.Size = 500
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
			a.Order[orderBy] = bucketAgg.Settings.Get("order").MustString("desc")

			if _, err := strconv.Atoi(orderBy); err == nil {
				for _, m := range metrics {
					if m.ID == orderBy {
						b.Metric(m.ID, m.Type, m.Field, nil)
						break
					}
				}
			}
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
