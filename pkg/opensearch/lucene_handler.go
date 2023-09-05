package opensearch

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	es "github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/grafana/opensearch-datasource/pkg/tsdb"
	"github.com/grafana/opensearch-datasource/pkg/utils"
)

type luceneHandler struct {
	client             es.Client
	reqQueries         []backend.DataQuery
	intervalCalculator tsdb.IntervalCalculator
	ms                 *es.MultiSearchRequestBuilder
	queries            []*Query
}

func newLuceneHandler(client es.Client, queries []backend.DataQuery, intervalCalculator tsdb.IntervalCalculator) *luceneHandler {
	return &luceneHandler{
		client:             client,
		reqQueries:         queries,
		intervalCalculator: intervalCalculator,
		ms:                 client.MultiSearch(),
		queries:            make([]*Query, 0),
	}
}

func (h *luceneHandler) processQuery(q *Query) error {
	if len(q.BucketAggs) == 0 {
		// If no aggregations, only document and logs queries are valid
		if len(q.Metrics) == 0 || !(q.Metrics[0].Type == rawDataType || q.Metrics[0].Type == rawDocumentType) {
			return fmt.Errorf("invalid query, missing metrics and aggregations")
		}
	}

	fromMs := h.reqQueries[0].TimeRange.From.UnixNano() / int64(time.Millisecond)
	toMs := h.reqQueries[0].TimeRange.To.UnixNano() / int64(time.Millisecond)

	minInterval, err := h.client.GetMinInterval(q.Interval)
	if err != nil {
		return err
	}
	interval := h.intervalCalculator.Calculate(&h.reqQueries[0].TimeRange, minInterval)

	h.queries = append(h.queries, q)

	b := h.ms.Search(interval)
	b.Size(1000)

	if q.luceneQueryType == luceneQueryTypeTraces {
		b.SetTraceListFilters(toMs, fromMs, q.RawQuery)
		aggBuilder := b.Agg()
		aggBuilder.TraceList()
		return nil
	}

	filters := b.Query().Bool().Filter()
	defaultTimeField := h.client.GetConfiguredFields().TimeField
	// filters.AddDateRangeFilter(defaultTimeField, es.DateFormatEpochMS, toMs, fromMs)

	// I don't think we support any kind of additional filtering with traces apart from traceId?
	if q.RawQuery != "" && q.LuceneQueryType != "Traces" {
		filters.AddQueryStringFilter(q.RawQuery, true)
	}

	if q.LuceneQueryType == "Traces" {
		traceId, err := getTraceId(q.RawQuery)
		if err != nil {
			return err
		}
		if traceId != "" {
			processTraceSpansQuery(q, b, traceId, fromMs, toMs)
		}
		processTraceListQuery(q, b, fromMs, toMs)
	} else {
		filters := b.Query().Bool().Filter()
		defaultTimeField := h.client.GetConfiguredFields().TimeField
		filters.AddDateRangeFilter(defaultTimeField, es.DateFormatEpochMS, toMs, fromMs)

		// I don't think we support any kind of additional filtering with traces apart from traceId?
		if q.RawQuery != "" {
			filters.AddQueryStringFilter(q.RawQuery, true)
		}

		if len(q.BucketAggs) == 0 {
			// If no aggregations, only document and logs queries are valid
			if q.LuceneQueryType == "traces" && (len(q.Metrics) == 0 || !(q.Metrics[0].Type == rawDataType || q.Metrics[0].Type == rawDocumentType)) {
				return fmt.Errorf("invalid query, missing metrics and aggregations")
			}
		}

		switch q.Metrics[0].Type {
		case rawDocumentType, rawDataType:
			processDocumentQuery(q, b, defaultTimeField)
		case logsType:
			processLogsQuery(q, b, fromMs, toMs, defaultTimeField)
		default:
			processTimeSeriesQuery(q, b, fromMs, toMs, defaultTimeField)
		}

	}
	return nil
}

func processTraceSpansQuery(q *Query, b *es.SearchRequestBuilder, traceId string, fromMs int64, toMs int64) {
	must := b.Query().Bool().Must()
	must.AddMustFilter("TraceId", traceId)
	must.AddStartTimeFilter(fromMs, toMs)
	// must.AddMustFilter("traceGroup", "something")
}

func processTraceListQuery(q *Query, b *es.SearchRequestBuilder, from, to int64) {
	// add traceId aggregation
	// q.BucketAgg = append(q.BucketAggs, &BucketAgg{
	// 	Type:  termsType,
	// 	Field: "traceId",
	// 	ID:    "1",
	// })

	// aggBuilder := b.Agg()
	// aggBuilder = aggBuilder.Terms("traces", "traceId", func(a *es.TermsAggregation, b es.AggBuilder) {
	// 	// TODO configurable from qeditor?
	// 	a.Size = 100
	// 	a.Order = map[string]string{_key: "asc"}

	// 	if minDocCount, err := bucketAgg.Settings.Get("min_doc_count").Int(); err == nil {
	// 		a.MinDocCount = &minDocCount
	// 	}
	// 	if missing, err := bucketAgg.Settings.Get("missing").String(); err == nil {
	// 		a.Missing = &missing
	// 	}

	// 	if orderBy, err := bucketAgg.Settings.Get("orderBy").String(); err == nil {
	// 		a.Order[orderBy] = bucketAgg.Settings.Get("order").MustString("desc")

	// 		if _, err := strconv.Atoi(orderBy); err == nil {
	// 			for _, m := range metrics {
	// 				if m.ID == orderBy {
	// 					b.Metric(m.ID, m.Type, m.Field, nil)
	// 					break
	// 				}
	// 			}
	// 		}
	// 	}

	// 	aggBuilder = b
	// })
}

// return {

// 	  aggs: {
// 		// create a set of buckets that we call traces
// 		traces: {
// 		  // each of those buckets in traces is sorted by a key of their traceId
// 		  // they contain any document, in this case all the spans of a trace
// 		  terms: {
// 			field: 'traceId',
// 			size: 100,
// 			order: { _key: 'asc' },
// 		  },
// 		  // within each of those buckets we create further aggregations based on what's in that bucket
// 		  aggs: {
// 			// one of those aggregations is a metric we call latency which is based on the durationInNanos
// 			// this script was taken directly from the network tab in the traces dashboard
// 			latency: {
// 			  max: {
// 				script: {
// 				  source:
// 					"\n                if (doc.containsKey('traceGroupFields.durationInNanos') && !doc['traceGroupFields.durationInNanos'].empty) {\n                  return Math.round(doc['traceGroupFields.durationInNanos'].value / 10000) / 100.0\n                }\n                return 0\n                ",
// 				  lang: 'painless',
// 				},
// 			  },
// 			},
// 			// one of those aggregations is the first traceGroup value it finds in the bucket
// 			trace_group: {
// 			  terms: {
// 				field: 'traceGroup',
// 				size: 1,
// 			  },
// 			},
// 			// one of aggregations is the the number of items in the bucket that has a status code of 2
// 			error_count: {
// 			  filter: { term: { 'traceGroupFields.statusCode': '2' } },
// 			},
// 			// one of those aggregations is the span with the max endTime
// 			last_updated: { max: { field: 'traceGroupFields.endTime' } },
// 		  },
// 		},
// 	  },
// 	};
// }

func getTraceId(rawQuery string) (string, error) {
	re := regexp.MustCompile(`traceId=(.+)`)
	matches := re.FindStringSubmatch(rawQuery)

	if len(matches) != 2 {
		return "", fmt.Errorf("Trace ID not found in the input string")
	}

	return matches[1], nil
}

func processLogsQuery(q *Query, b *es.SearchRequestBuilder, from, to int64, defaultTimeField string) {
	metric := q.Metrics[0]
	b.Sort(descending, defaultTimeField, "boolean")
	b.AddDocValueField(defaultTimeField)
	b.AddTimeFieldWithStandardizedFormat(defaultTimeField)
	sizeString := metric.Settings.Get("size").MustString()
	size, err := strconv.Atoi(sizeString)
	if err != nil {
		size = defaultSize
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

func processTraces(q *Query, b *es.SearchRequestBuilder) {

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

	req, err := h.ms.Build()
	if err != nil {
		return nil, err
	}

	res, err := h.client.ExecuteMultisearch(ctx, req)
	if err != nil {
		return nil, err
	}

	rp := newResponseParser(res.Responses, h.queries, res.DebugInfo)
	return rp.getTimeSeries(h.client.GetConfiguredFields())
}

// func addTraceAgg(aggBuilder es.AggBuilder) es.AggBuilder {
// 	b, err := a.boolQueryBuilder.Build()
// 	termsBuilder = aggBuilder.Terms("traces", "traceId", func(a *es.TermsAggregation, b es.AggBuilder) {
// 		// TODO configurable from qeditor?
// 		a.Size = 100
// 		a.Order = map[string]interface{}{
// 			"traces": map[string]string{
// 				"_key": "asc",
// 			},
// 		}

// 		// if minDocCount, err := bucketAgg.Settings.Get("min_doc_count").Int(); err == nil {
// 		// 	a.MinDocCount = &minDocCount
// 		// }
// 		// if missing, err := bucketAgg.Settings.Get("missing").String(); err == nil {
// 		// 	a.Missing = &missing
// 		// }

// 	})
// 	// 	metricAggs := []*MetricAgg
// 	// 	metricAggs = append(metricAggs, *MetricAgg{
// 	// 		ID: "1",
// 	// 		Type: "max",
// 	// 		Field: "latency",
// 	// 		Settings: utils.NewJsonFromAny(map[string]interface{}{
// 	// 			script: {
// 	// 				source: "\n                if (doc.containsKey('traceGroupFields.durationInNanos') && !doc['traceGroupFields.durationInNanos'].empty) {\n                  return Math.round(doc['traceGroupFields.durationInNanos'].value / 10000) / 100.0\n                }\n                return 0\n                ",
// 	// 		   		lang: "painless",
// 	// 	  }})
// 	// 	})
// 	// metricAggs = append(metricAggs, *MetricAgg{
// 	// 		ID: "2",
// 	// 		Type: "terms",
// 	// 		Field: "traceGroup",
// 	// 		Settings: utils.NewJsonFromAny(map[string]interface{}{field: "traceGroup", size: 1}})
// 	// 	})
// 	// metricAggs = append(metricAggs, *MetricAgg{
// 	// 		ID: "3",
// 	// 		Type: "filter",
// 	// 		Field: "error_count",
// 	// 		Settings: utils.NewJsonFromAny({term: { "traceGroupFields.statusCode": "2'"}})
// 	// 	})
// 	// metricAggs = append(metricAggs, *MetricAgg{
// 	// 		ID: "4",
// 	// 		Type: "max",
// 	// 		Field: "last_updated",
// 	// 		Settings: utils.NewJsonFromAny({field: "traceGroupFields.endTime"})
// 	// 	})

// }

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
