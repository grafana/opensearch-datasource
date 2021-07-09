package elasticsearch

import (
	"strconv"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	es "github.com/grafana/open-distro-for-elasticsearch-grafana-datasource/pkg/elasticsearch/client"
	"github.com/grafana/open-distro-for-elasticsearch-grafana-datasource/pkg/tsdb"
	"github.com/grafana/open-distro-for-elasticsearch-grafana-datasource/pkg/utils"
)

type timeSeriesQuery struct {
	client             es.Client
	tsdbQuery          *backend.QueryDataRequest
	intervalCalculator tsdb.IntervalCalculator
}

var newTimeSeriesQuery = func(client es.Client, req *backend.QueryDataRequest, intervalCalculator tsdb.IntervalCalculator) *timeSeriesQuery {
	return &timeSeriesQuery{
		client:             client,
		tsdbQuery:          req,
		intervalCalculator: intervalCalculator,
	}
}

func (e *timeSeriesQuery) execute() (*backend.QueryDataResponse, error) {
	handlers := make(map[string]queryHandler)

	handlers[Lucene] = newLuceneHandler(e.client, e.tsdbQuery, e.intervalCalculator)
	handlers[PPL] = newPPLHandler(e.client, e.tsdbQuery)

	tsQueryParser := newTimeSeriesQueryParser()
	queries, err := tsQueryParser.parse(e.tsdbQuery)
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
		response, err := handler.executeQueries()
		if err != nil {
			return nil, err
		}
		if response != nil {
			responses = append(responses, response)
		}
	}

	return mergeResponses(responses...), nil
}

type timeSeriesQueryParser struct{}

func newTimeSeriesQueryParser() *timeSeriesQueryParser {
	return &timeSeriesQueryParser{}
}

func (p *timeSeriesQueryParser) parse(tsdbQuery *backend.QueryDataRequest) ([]*Query, error) {
	queries := make([]*Query, 0)
	for _, q := range tsdbQuery.Queries {
		model, _ := simplejson.NewJson(q.JSON)
		timeField, err := model.Get("timeField").String()
		if err != nil {
			return nil, err
		}
		rawQuery := model.Get("query").MustString()
		queryType := model.Get("queryType").MustString(Lucene)
		bucketAggs, err := p.parseBucketAggs(model)
		if err != nil {
			return nil, err
		}
		metrics, err := p.parseMetrics(model)
		if err != nil {
			return nil, err
		}
		alias := model.Get("alias").MustString("")
		interval := strconv.FormatInt(q.Interval.Milliseconds(), 10) + "ms"

		queries = append(queries, &Query{
			TimeField:  timeField,
			RawQuery:   rawQuery,
			QueryType:  queryType,
			BucketAggs: bucketAggs,
			Metrics:    metrics,
			Alias:      alias,
			Interval:   interval,
			RefID:      q.RefID,
		})
	}

	return queries, nil
}

func (p *timeSeriesQueryParser) parseBucketAggs(model *simplejson.Json) ([]*BucketAgg, error) {
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

func (p *timeSeriesQueryParser) parseMetrics(model *simplejson.Json) ([]*MetricAgg, error) {
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
