package opensearch

import (
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	es "github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/grafana/opensearch-datasource/pkg/tsdb"
	"github.com/grafana/opensearch-datasource/pkg/utils"
)

type luceneHandler struct {
	client             es.Client
	req                *backend.QueryDataRequest
	intervalCalculator tsdb.IntervalCalculator
	ms                 *es.MultiSearchRequestBuilder
	queries            []*Query
}

var newLuceneHandler = func(client es.Client, req *backend.QueryDataRequest, intervalCalculator tsdb.IntervalCalculator) *luceneHandler {
	return &luceneHandler{
		client:             client,
		req:                req,
		intervalCalculator: intervalCalculator,
		ms:                 client.MultiSearch(),
		queries:            make([]*Query, 0),
	}
}

func (h *luceneHandler) processQuery(q *Query) error {
	fromMs := h.req.Queries[0].TimeRange.From.UnixNano() / int64(time.Millisecond)
	toMs := h.req.Queries[0].TimeRange.To.UnixNano() / int64(time.Millisecond)

	minInterval, err := h.client.GetMinInterval(q.Interval)
	if err != nil {
		return err
	}
	interval := h.intervalCalculator.Calculate(&h.req.Queries[0].TimeRange, minInterval)

	h.queries = append(h.queries, q)

	b := h.ms.Search(interval)
	b.Size(0)
	filters := b.Query().Bool().Filter()
	defaultTimeField := h.client.GetConfiguredFields().TimeField
	filters.AddDateRangeFilter(defaultTimeField, es.DateFormatEpochMS, toMs, fromMs)

	if q.RawQuery != "" {
		filters.AddQueryStringFilter(q.RawQuery, true)
	}

	if len(q.BucketAggs) == 0 {
		// If no aggregations, only document and logs queries are valid
		if len(q.Metrics) == 0 || !(q.Metrics[0].Type == rawDataType || q.Metrics[0].Type == rawDocumentType) {
			return fmt.Errorf("invalid query, missing metrics and aggregations")
		}
	}

	switch q.Metrics[0].Type {
	case rawDocumentType, rawDataType:
		processDocumentQuery(q, b, defaultTimeField)
	default:
		processTimeSeriesQuery(q, b, fromMs, toMs, defaultTimeField)
	}

	return nil
}

const defaultSize = 500

func processDocumentQuery(q *Query, b *es.SearchRequestBuilder, defaultTimeField string) {
	metric := q.Metrics[0]
	order := metric.Settings.Get("order").MustString()
	b.Sort(order, defaultTimeField, "boolean")
	b.Sort(order, "_doc", "")
	b.AddTimeFieldWithStandardizedFormat(defaultTimeField)
	sizeString := metric.Settings.Get("size").MustString()
	size, err := strconv.Atoi(sizeString)
	if err != nil {
		size = defaultSize
	}
	b.Size(size)
}

func processTimeSeriesQuery(q *Query, b *es.SearchRequestBuilder, fromMs int64, toMs int64, defaultTimeField string) {
	metric := q.Metrics[0]
	b.Size(metric.Settings.Get("size").MustInt(500))
	aggBuilder := b.Agg()

	// iterate backwards to create aggregations bottom-down
	for _, bucketAgg := range q.BucketAggs {
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

					aggBuilder.Pipeline(m.ID, m.Type, bucketPaths, func(a *es.PipelineAggregation) {
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

						aggBuilder.Pipeline(m.ID, m.Type, bucketPath, func(a *es.PipelineAggregation) {
							a.Settings = m.Settings.MustMap()
						})
					}
				} else {
					continue
				}
			}
		} else {
			aggBuilder.Metric(m.ID, m.Type, m.Field, func(a *es.MetricAggregation) {
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

func (h *luceneHandler) executeQueries() (*backend.QueryDataResponse, error) {
	if len(h.queries) == 0 {
		return nil, nil
	}

	req, err := h.ms.Build()
	if err != nil {
		return nil, err
	}

	res, err := h.client.ExecuteMultisearch(req)
	if err != nil {
		return nil, err
	}

	rp := newResponseParser(res.Responses, h.queries, res.DebugInfo)
	return rp.getTimeSeries(h.client.GetConfiguredFields())
}

func addDateHistogramAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg, timeFrom, timeTo int64, timeField string) es.AggBuilder {
	// If no field is specified, use the time field
	field := bucketAgg.Field
	if field == "" {
		field = timeField
	}
	aggBuilder.DateHistogram(bucketAgg.ID, field, func(a *es.DateHistogramAgg, b es.AggBuilder) {
		a.Interval = bucketAgg.Settings.Get("interval").MustString("auto")
		a.MinDocCount = bucketAgg.Settings.Get("min_doc_count").MustInt(0)
		a.ExtendedBounds = &es.ExtendedBounds{Min: timeFrom, Max: timeTo}
		a.Format = bucketAgg.Settings.Get("format").MustString(es.DateFormatEpochMS)

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

func addHistogramAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	aggBuilder.Histogram(bucketAgg.ID, bucketAgg.Field, func(a *es.HistogramAgg, b es.AggBuilder) {
		a.Interval = bucketAgg.Settings.Get("interval").MustInt(1000)
		a.MinDocCount = bucketAgg.Settings.Get("min_doc_count").MustInt(0)

		if missing, err := bucketAgg.Settings.Get("missing").Int(); err == nil {
			a.Missing = &missing
		}

		aggBuilder = b
	})

	return aggBuilder
}

func addTermsAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg, metrics []*MetricAgg) es.AggBuilder {
	aggBuilder.Terms(bucketAgg.ID, bucketAgg.Field, func(a *es.TermsAggregation, b es.AggBuilder) {
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

func addFiltersAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	filters := make(map[string]interface{})
	for _, filter := range bucketAgg.Settings.Get("filters").MustArray() {
		json := utils.NewJsonFromAny(filter)
		query := json.Get("query").MustString()
		label := json.Get("label").MustString()
		if label == "" {
			label = query
		}
		filters[label] = &es.QueryStringFilter{Query: query, AnalyzeWildcard: true}
	}

	if len(filters) > 0 {
		aggBuilder.Filters(bucketAgg.ID, func(a *es.FiltersAggregation, b es.AggBuilder) {
			a.Filters = filters
			aggBuilder = b
		})
	}

	return aggBuilder
}

func addGeoHashGridAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	aggBuilder.GeoHashGrid(bucketAgg.ID, bucketAgg.Field, func(a *es.GeoHashGridAggregation, b es.AggBuilder) {
		a.Precision = bucketAgg.Settings.Get("precision").MustInt(3)
		aggBuilder = b
	})

	return aggBuilder
}
