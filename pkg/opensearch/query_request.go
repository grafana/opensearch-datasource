package opensearch

import (
	"context"
	"fmt"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/grafana/opensearch-datasource/pkg/tsdb"
	"github.com/grafana/opensearch-datasource/pkg/utils"
)

type queryRequest struct {
	client             client.Client
	queries            []backend.DataQuery
	dsSettings         *backend.DataSourceInstanceSettings
	intervalCalculator tsdb.IntervalCalculator
}

func newQueryRequest(client client.Client, queries []backend.DataQuery, dsSettings *backend.DataSourceInstanceSettings, intervalCalculator tsdb.IntervalCalculator) *queryRequest {
	return &queryRequest{
		client:             client,
		queries:            queries,
		dsSettings:         dsSettings,
		intervalCalculator: intervalCalculator,
	}
}

func (e *queryRequest) execute(ctx context.Context) (*backend.QueryDataResponse, error) {
	handlers := make(map[string]queryHandler)

	handlers[Lucene] = newLuceneHandler(e.client, e.queries, e.intervalCalculator, e.dsSettings)
	handlers[PPL] = newPPLHandler(e.client, e.queries)

	queries, err := parse(e.queries)
	if err != nil {
		return nil, err
	}

	for _, q := range queries {
		if err := handlers[q.QueryType].processQuery(q); err != nil {
			return nil, err
		}
	}

	responses := make([]*backend.QueryDataResponse, 0)

	for _, handler := range handlers {
		response, err := handler.executeQueries(ctx)
		if err != nil {
			return nil, err
		}
		if response != nil {
			responses = append(responses, response)
		}
	}

	return mergeResponses(responses...), nil
}

type invalidQueryTypeError struct {
	refId string
}

func (e invalidQueryTypeError) Error() string {
	return "invalid queryType"
}

func parse(reqQueries []backend.DataQuery) ([]*Query, error) {
	queries := make([]*Query, 0)
	for _, q := range reqQueries {
		model, _ := simplejson.NewJson(q.JSON)
		// we had a string-field named `timeField` in the past. we do not use it anymore.
		// please do not create a new field with that name, to avoid potential problems with old, persisted queries.
		rawQuery := model.Get("query").MustString()
		queryType := model.Get("queryType").MustString("lucene")
		if queryType != Lucene && queryType != PPL {
			return nil,
				fmt.Errorf("%w: %q", invalidQueryTypeError{refId: q.RefID}, queryType)
		}
		luceneQueryType := model.Get("luceneQueryType").MustString()
		bucketAggs, err := parseBucketAggs(model)
		if err != nil {
			return nil, err
		}
		metrics, err := parseMetrics(model)
		if err != nil {
			return nil, err
		}
		alias := model.Get("alias").MustString("")
		format := model.Get("format").MustString("")

		// For queries requesting the service map, we inject extra queries to handle retrieving
		// the required information
		hasServiceMap := model.Get("serviceMap").MustBool(false)
		if luceneQueryType == luceneQueryTypeTraces && hasServiceMap {
			// The Prefetch request is used by itself for internal use, to get the parameters
			// necessary for the Stats request. In this case there's no original query to
			// pass along, so we continue below.
			if model.Get("serviceMapPrefetch").MustBool() {
				queries = append(queries, &Query{
					RawQuery:        rawQuery,
					QueryType:       queryType,
					luceneQueryType: luceneQueryType,
					RefID:           q.RefID,
					serviceMapInfo: serviceMapInfo{
						Type: Prefetch,
					},
				})
				//don't append the original query in this case
				continue
			}
			// For service map requests that are not prefetch, we add extra queries - one
			// for the service map and one for the associated stats. We also add the
			// original query below.
			queries = append(queries,
				&Query{
					RawQuery:        rawQuery,
					QueryType:       queryType,
					luceneQueryType: luceneQueryType,
					RefID:           q.RefID,
					serviceMapInfo: serviceMapInfo{
						Type: Stats,
						Parameters: client.StatsParameters{
							ServiceNames: model.Get("services").MustStringArray(),
							Operations:   model.Get("operations").MustStringArray(),
						},
					},
					TimeRange: q.TimeRange,
				},
				&Query{
					RawQuery:        rawQuery,
					QueryType:       queryType,
					luceneQueryType: luceneQueryType,
					RefID:           q.RefID,
					serviceMapInfo:  serviceMapInfo{Type: ServiceMap},
				},
			)
		}

		queries = append(queries, &Query{
			RawQuery:        rawQuery,
			QueryType:       queryType,
			luceneQueryType: luceneQueryType,
			BucketAggs:      bucketAggs,
			Metrics:         metrics,
			Alias:           alias,
			Interval:        q.Interval,
			RefID:           q.RefID,
			Format:          format,
		})
	}

	return queries, nil
}

func parseBucketAggs(model *simplejson.Json) ([]*BucketAgg, error) {
	var err error
	var result []*BucketAgg
	for _, t := range model.Get("bucketAggs").MustArray() {
		aggJSON := utils.NewJsonFromAny(t)
		agg := &BucketAgg{}

		agg.Type, err = aggJSON.Get("type").String()
		if err != nil {
			return nil, err
		}

		agg.ID, err = aggJSON.Get("id").String()
		if err != nil {
			return nil, err
		}

		agg.Field = aggJSON.Get("field").MustString()
		agg.Settings = utils.NewJsonFromAny(aggJSON.Get("settings").MustMap())

		result = append(result, agg)
	}
	return result, nil
}

func parseMetrics(model *simplejson.Json) ([]*MetricAgg, error) {
	var err error
	var result []*MetricAgg
	for _, t := range model.Get("metrics").MustArray() {
		metricJSON := utils.NewJsonFromAny(t)
		metric := &MetricAgg{}

		metric.Field = metricJSON.Get("field").MustString()
		metric.Hide = metricJSON.Get("hide").MustBool(false)
		metric.ID = metricJSON.Get("id").MustString()
		metric.PipelineAggregate = metricJSON.Get("pipelineAgg").MustString()
		metric.Settings = utils.NewJsonFromAny(metricJSON.Get("settings").MustMap())
		metric.Meta = utils.NewJsonFromAny(metricJSON.Get("meta").MustMap())
		metric.Type, err = metricJSON.Get("type").String()
		if err != nil {
			return nil, err
		}

		if isPipelineAggWithMultipleBucketPaths(metric.Type) {
			metric.PipelineVariables = map[string]string{}
			pvArr := metricJSON.Get("pipelineVariables").MustArray()
			for _, v := range pvArr {
				kv := v.(map[string]interface{})
				metric.PipelineVariables[kv["name"].(string)] = kv["pipelineAgg"].(string)
			}
		}

		result = append(result, metric)
	}
	return result, nil
}

func mergeResponses(responses ...*backend.QueryDataResponse) *backend.QueryDataResponse {
	result := &backend.QueryDataResponse{
		Responses: backend.Responses{},
	}
	for _, response := range responses {
		for k, v := range response.Responses {
			result.Responses[k] = v
		}
	}
	return result
}
