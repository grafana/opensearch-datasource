package opensearch

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Masterminds/semver"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	es "github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/grafana/opensearch-datasource/pkg/tsdb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_raw_data(t *testing.T) {
	t.Run("With raw data metric query (from frontend tests)", func(t *testing.T) {
		from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
		to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
		fromMs := from.UnixNano() / int64(time.Millisecond)
		toMs := to.UnixNano() / int64(time.Millisecond)
		c := newFakeClient(es.OpenSearch, "2.3.0")

		_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_data", "settings": {"size": "1337" }	}]
			}`, from, to, 15*time.Second)
		require.NoError(t, err)

		sr := c.multisearchRequests[0].Requests[0]
		rangeFilter := sr.Query.Bool.Filters[0].(*es.RangeFilter)
		assert.Equal(t, "@timestamp", rangeFilter.Key)
		assert.Equal(t, toMs, rangeFilter.Lte)
		assert.Equal(t, fromMs, rangeFilter.Gte)
		assert.Equal(t, es.DateFormatEpochMS, rangeFilter.Format)

		assert.Equal(t, 1337, sr.Size)
		assert.Equal(t, map[string]map[string]string{"@timestamp": {"order": "desc", "unmapped_type": "boolean"}}, sr.Sort[0])
		assert.Equal(t, map[string]map[string]string{"_doc": {"order": "desc"}}, sr.Sort[1])
	})
}

func TestExecuteTimeSeriesQuery(t *testing.T) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	fromMs := from.UnixNano() / int64(time.Millisecond)
	toMs := to.UnixNano() / int64(time.Millisecond)
	t.Run("Test execute time series query", func(t *testing.T) {
		t.Run("With defaults on Elasticsearch 2.0.0", func(t *testing.T) {
			c := newFakeClient(es.Elasticsearch, "2.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "2" }],
				"metrics": [{"type": "count", "id": "0" }]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			rangeFilter := sr.Query.Bool.Filters[0].(*es.RangeFilter)
			assert.Equal(t, c.timeField, rangeFilter.Key)
			assert.Equal(t, toMs, rangeFilter.Lte)
			assert.Equal(t, fromMs, rangeFilter.Gte)
			assert.Equal(t, es.DateFormatEpochMS, rangeFilter.Format)
			assert.Equal(t, "2", sr.Aggs[0].Key)
			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)
			assert.Equal(t, "@timestamp", dateHistogramAgg.Field)
			assert.Equal(t, fromMs, dateHistogramAgg.ExtendedBounds.Min)
			assert.Equal(t, toMs, dateHistogramAgg.ExtendedBounds.Max)
		})

		t.Run("With defaults on Elasticsearch 5.0.0", func(t *testing.T) {
			c := newFakeClient(es.Elasticsearch, "5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "2" }],
				"metrics": [{"type": "count", "id": "0" }]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			assert.Equal(t, c.timeField, sr.Query.Bool.Filters[0].(*es.RangeFilter).Key)
			assert.Equal(t, "2", sr.Aggs[0].Key)
			assert.Equal(t, fromMs, sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg).ExtendedBounds.Min)
			assert.Equal(t, toMs, sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg).ExtendedBounds.Max)
		})

		t.Run("With multiple bucket aggs", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "terms", "field": "@host", "id": "2", "settings": { "size": "0", "order": "asc" } },
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			assert.Equal(t, "2", firstLevel.Key)
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)
			assert.Equal(t, "@host", termsAgg.Field)
			assert.Equal(t, 500, termsAgg.Size)
			secondLevel := firstLevel.Aggregation.Aggs[0]
			assert.Equal(t, "3", secondLevel.Key)
			assert.Equal(t, "@timestamp", secondLevel.Aggregation.Aggregation.(*es.DateHistogramAgg).Field)
		})

		t.Run("With select field", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "2" }
				],
				"metrics": [{"type": "avg", "field": "@value", "id": "1" }]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			assert.Equal(t, "2", firstLevel.Key)
			assert.Equal(t, "@timestamp", firstLevel.Aggregation.Aggregation.(*es.DateHistogramAgg).Field)
			secondLevel := firstLevel.Aggregation.Aggs[0]
			assert.Equal(t, "1", secondLevel.Key)
			assert.Equal(t, "avg", secondLevel.Aggregation.Type)
			assert.Equal(t, "@value", secondLevel.Aggregation.Aggregation.(*es.MetricAggregation).Field)
		})

		t.Run("With term agg and order by metric agg", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"type": "terms",
						"field": "@host",
						"id": "2",
						"settings": { "size": "5", "order": "asc", "orderBy": "5"	}
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
					{"type": "count", "id": "1" },
					{"type": "avg", "field": "@value", "id": "5" }
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			avgAggOrderBy := sr.Aggs[0].Aggregation.Aggs[0]
			assert.Equal(t, "5", avgAggOrderBy.Key)
			assert.Equal(t, "avg", avgAggOrderBy.Aggregation.Type)

			avgAgg := sr.Aggs[0].Aggregation.Aggs[1].Aggregation.Aggs[0]
			assert.Equal(t, "5", avgAgg.Key)
			assert.Equal(t, "avg", avgAgg.Aggregation.Type)
		})

		t.Run("With term agg and order by term with Elasticsearch <6.0.0, _term is used for Order", func(t *testing.T) {
			c := newFakeClient(es.Elasticsearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"type": "terms",
						"field": "@host",
						"id": "2",
						"settings": { "size": "5", "order": "asc", "orderBy": "_term"	}
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
					{"type": "count", "id": "1" },
					{"type": "avg", "field": "@value", "id": "5" }
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "2", firstLevel.Key)
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)
			assert.Equal(t, "asc", termsAgg.Order["_term"])
		})

		t.Run("With term agg and order by term with Elasticsearch 6.x, _term is replaced by _key", func(t *testing.T) {
			c := newFakeClient(es.Elasticsearch, "6.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"type": "terms",
						"field": "@host",
						"id": "2",
						"settings": { "size": "5", "order": "asc", "orderBy": "_term"	}
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
					{"type": "count", "id": "1" },
					{"type": "avg", "field": "@value", "id": "5" }
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "2", firstLevel.Key)
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)
			assert.Equal(t, "asc", termsAgg.Order["_key"])
		})

		t.Run("With term agg and order by term with OpenSearch, _term is replaced by _key", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"type": "terms",
						"field": "@host",
						"id": "2",
						"settings": { "size": "5", "order": "asc", "orderBy": "_term"	}
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
					{"type": "count", "id": "1" },
					{"type": "avg", "field": "@value", "id": "5" }
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "2", firstLevel.Key)
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)
			assert.Equal(t, "asc", termsAgg.Order["_key"])
		})

		t.Run("With term agg and valid min_doc_count", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "2.3.0")
			_, err := executeTsdbQuery(c, `{
				"bucketAggs": [
					{
						"type": "terms",
						"field": "@host",
						"id": "2",
						"settings": { "min_doc_count": "1" }
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
					{"type": "count", "id": "1" }
				]
			}`, from, to, 15*time.Second)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "2")
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)
			expectedMinDocCount := 1
			require.Equal(t, &expectedMinDocCount, termsAgg.MinDocCount)
		})

		t.Run("With metric percentiles", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
					{
						"id": "1",
						"type": "percentiles",
						"field": "@load_time",
						"settings": {
							"percents": [ "1", "2", "3", "4" ]
						}
					}
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			percentilesAgg := sr.Aggs[0].Aggregation.Aggs[0]
			assert.Equal(t, "1", percentilesAgg.Key)
			assert.Equal(t, "percentiles", percentilesAgg.Aggregation.Type)
			metricAgg := percentilesAgg.Aggregation.Aggregation.(*es.MetricAggregation)
			percents := metricAgg.Settings["percents"].([]interface{})
			assert.Len(t, percents, 4)
			assert.Equal(t, "1", percents[0])
			assert.Equal(t, "2", percents[1])
			assert.Equal(t, "3", percents[2])
			assert.Equal(t, "4", percents[3])
		})

		t.Run("With filters aggs", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"id": "2",
						"type": "filters",
						"settings": {
							"filters": [ { "query": "@metric:cpu" }, { "query": "@metric:logins.count" } ]
						}
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			filtersAgg := sr.Aggs[0]
			assert.Equal(t, "2", filtersAgg.Key)
			assert.Equal(t, "filters", filtersAgg.Aggregation.Type)
			fAgg := filtersAgg.Aggregation.Aggregation.(*es.FiltersAggregation)
			assert.Equal(t, "@metric:cpu", fAgg.Filters["@metric:cpu"].(*es.QueryStringFilter).Query)
			assert.Equal(t, "@metric:logins.count", fAgg.Filters["@metric:logins.count"].(*es.QueryStringFilter).Query)

			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggs[0]
			assert.Equal(t, "4", dateHistogramAgg.Key)
			assert.Equal(t, "@timestamp", dateHistogramAgg.Aggregation.Aggregation.(*es.DateHistogramAgg).Field)
		})

		t.Run("With raw document metric", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_document", "settings": {}	}]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			assert.Equal(t, 500, sr.Size)
		})

		t.Run("With raw document metric size set", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_document", "settings": { "size": "1337" }	}]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			assert.Equal(t, 1337, sr.Size)
		})

		t.Run("With date histogram agg", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"id": "2",
						"type": "date_histogram",
						"field": "@timestamp",
						"settings": { "interval": "auto", "min_doc_count": 2 }
					}
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "2", firstLevel.Key)
			assert.Equal(t, "date_histogram", firstLevel.Aggregation.Type)
			hAgg := firstLevel.Aggregation.Aggregation.(*es.DateHistogramAgg)
			assert.Equal(t, "@timestamp", hAgg.Field)
			assert.Equal(t, "$__interval", hAgg.Interval)
			assert.Equal(t, 2, hAgg.MinDocCount)
		})

		t.Run("With histogram agg", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"id": "3",
						"type": "histogram",
						"field": "bytes",
						"settings": { "interval": 10, "min_doc_count": 2, "missing": 5 }
					}
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "3", firstLevel.Key)
			assert.Equal(t, "histogram", firstLevel.Aggregation.Type)
			hAgg := firstLevel.Aggregation.Aggregation.(*es.HistogramAgg)
			assert.Equal(t, "bytes", hAgg.Field)
			assert.Equal(t, 10, hAgg.Interval)
			assert.Equal(t, 2, hAgg.MinDocCount)
			assert.Equal(t, 5, *hAgg.Missing)
		})

		t.Run("With geo hash grid agg", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"id": "3",
						"type": "geohash_grid",
						"field": "@location",
						"settings": { "precision": 3 }
					}
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "3", firstLevel.Key)
			assert.Equal(t, "geohash_grid", firstLevel.Aggregation.Type)
			ghGridAgg := firstLevel.Aggregation.Aggregation.(*es.GeoHashGridAggregation)
			assert.Equal(t, "@location", ghGridAgg.Field)
			assert.Equal(t, 3, ghGridAgg.Precision)
		})

		t.Run("With moving average", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "moving_avg",
						"field": "3",
						"pipelineAgg": "3"
					}
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "4", firstLevel.Key)
			assert.Equal(t, "date_histogram", firstLevel.Aggregation.Type)
			assert.Len(t, firstLevel.Aggregation.Aggs, 2)

			sumAgg := firstLevel.Aggregation.Aggs[0]
			assert.Equal(t, "3", sumAgg.Key)
			assert.Equal(t, "sum", sumAgg.Aggregation.Type)
			mAgg := sumAgg.Aggregation.Aggregation.(*es.MetricAggregation)
			assert.Equal(t, "@value", mAgg.Field)

			movingAvgAgg := firstLevel.Aggregation.Aggs[1]
			assert.Equal(t, "2", movingAvgAgg.Key)
			assert.Equal(t, "moving_avg", movingAvgAgg.Aggregation.Type)
			pl := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			assert.Equal(t, "3", pl.BucketPath)
		})

		t.Run(`With moving average without "pipelineAgg" in input gets "pipelineAggField" from "field"`, func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "moving_avg",
						"field": "3"
					}
				]
			}`, from, to, 15*time.Second)
			assert.Nil(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "4", firstLevel.Key)
			assert.Equal(t, "date_histogram", firstLevel.Aggregation.Type)
			assert.Len(t, firstLevel.Aggregation.Aggs, 2)

			sumAgg := firstLevel.Aggregation.Aggs[0]
			assert.Equal(t, "3", sumAgg.Key)
			assert.Equal(t, "sum", sumAgg.Aggregation.Type)
			mAgg := sumAgg.Aggregation.Aggregation.(*es.MetricAggregation)
			assert.Equal(t, "@value", mAgg.Field)

			movingAvgAgg := firstLevel.Aggregation.Aggs[1]
			assert.Equal(t, "2", movingAvgAgg.Key)
			assert.Equal(t, "moving_avg", movingAvgAgg.Aggregation.Type)
			pl := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			assert.Equal(t, "3", pl.BucketPath)
		})

		t.Run("With moving average doc count", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "count", "field": "select field" },
					{
						"id": "2",
						"type": "moving_avg",
						"field": "3",
						"pipelineAgg": "3"
					}
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "4", firstLevel.Key)
			assert.Equal(t, "date_histogram", firstLevel.Aggregation.Type)
			assert.Len(t, firstLevel.Aggregation.Aggs, 1)

			movingAvgAgg := firstLevel.Aggregation.Aggs[0]
			assert.Equal(t, "2", movingAvgAgg.Key)
			assert.Equal(t, "moving_avg", movingAvgAgg.Aggregation.Type)
			pl := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			assert.Equal(t, "_count", pl.BucketPath)
		})

		t.Run("With broken moving average", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "5" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "moving_avg",
						"pipelineAgg": "3"
					},
					{
						"id": "4",
						"type": "moving_avg",
						"pipelineAgg": "Metric to apply moving average"
					}
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "5", firstLevel.Key)
			assert.Equal(t, "date_histogram", firstLevel.Aggregation.Type)

			assert.Len(t, firstLevel.Aggregation.Aggs, 2)

			movingAvgAgg := firstLevel.Aggregation.Aggs[1]
			assert.Equal(t, "2", movingAvgAgg.Key)
			plAgg := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			assert.Equal(t, "3", plAgg.BucketPath)
		})

		t.Run("With cumulative sum", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "cumulative_sum",
						"field": "3",
						"pipelineAgg": "3"
					}
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "4", firstLevel.Key)
			assert.Equal(t, "date_histogram", firstLevel.Aggregation.Type)
			assert.Len(t, firstLevel.Aggregation.Aggs, 2)

			sumAgg := firstLevel.Aggregation.Aggs[0]
			assert.Equal(t, "3", sumAgg.Key)
			assert.Equal(t, "sum", sumAgg.Aggregation.Type)
			mAgg := sumAgg.Aggregation.Aggregation.(*es.MetricAggregation)
			assert.Equal(t, "@value", mAgg.Field)

			cumulativeSumAgg := firstLevel.Aggregation.Aggs[1]
			assert.Equal(t, "2", cumulativeSumAgg.Key)
			assert.Equal(t, "cumulative_sum", cumulativeSumAgg.Aggregation.Type)
			pl := cumulativeSumAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			assert.Equal(t, "3", pl.BucketPath)
		})

		t.Run("With cumulative sum doc count", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "count", "field": "select field" },
					{
						"id": "2",
						"type": "cumulative_sum",
						"field": "3",
						"pipelineAgg": "3"
					}
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "4", firstLevel.Key)
			assert.Equal(t, "date_histogram", firstLevel.Aggregation.Type)
			assert.Len(t, firstLevel.Aggregation.Aggs, 1)

			cumulativeSumAgg := firstLevel.Aggregation.Aggs[0]
			assert.Equal(t, "2", cumulativeSumAgg.Key)
			assert.Equal(t, "cumulative_sum", cumulativeSumAgg.Aggregation.Type)
			pl := cumulativeSumAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			assert.Equal(t, "_count", pl.BucketPath)
		})

		t.Run("With broken cumulative sum", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "5" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "cumulative_sum",
						"pipelineAgg": "3"
					},
					{
						"id": "4",
						"type": "cumulative_sum",
						"pipelineAgg": "Metric to apply cumulative sum"
					}
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "5", firstLevel.Key)
			assert.Equal(t, "date_histogram", firstLevel.Aggregation.Type)

			assert.Len(t, firstLevel.Aggregation.Aggs, 2)

			cumulativeSumAgg := firstLevel.Aggregation.Aggs[1]
			assert.Equal(t, "2", cumulativeSumAgg.Key)
			plAgg := cumulativeSumAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			assert.Equal(t, "3", plAgg.BucketPath)
		})

		t.Run("With derivative", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "derivative",
						"pipelineAgg": "3"
					}
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "4", firstLevel.Key)
			assert.Equal(t, "date_histogram", firstLevel.Aggregation.Type)

			derivativeAgg := firstLevel.Aggregation.Aggs[1]
			assert.Equal(t, "2", derivativeAgg.Key)
			plAgg := derivativeAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			assert.Equal(t, "3", plAgg.BucketPath)
		})

		t.Run("With derivative doc count", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "count", "field": "select field" },
					{
						"id": "2",
						"type": "derivative",
						"pipelineAgg": "3"
					}
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "4", firstLevel.Key)
			assert.Equal(t, "date_histogram", firstLevel.Aggregation.Type)

			derivativeAgg := firstLevel.Aggregation.Aggs[0]
			assert.Equal(t, "2", derivativeAgg.Key)
			plAgg := derivativeAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			assert.Equal(t, "_count", plAgg.BucketPath)
		})

		t.Run("With bucket_script", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{ "id": "5", "type": "max", "field": "@value" },
					{
						"id": "2",
						"type": "bucket_script",
						"pipelineVariables": [
							{ "name": "var1", "pipelineAgg": "3" },
							{ "name": "var2", "pipelineAgg": "5" }
						],
						"settings": { "script": "params.var1 * params.var2" }
					}
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "4", firstLevel.Key)
			assert.Equal(t, "date_histogram", firstLevel.Aggregation.Type)

			bucketScriptAgg := firstLevel.Aggregation.Aggs[2]
			assert.Equal(t, "2", bucketScriptAgg.Key)
			plAgg := bucketScriptAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			assert.Equal(t, map[string]interface{}{
				"var1": "3",
				"var2": "5",
			}, plAgg.BucketPath.(map[string]interface{}))
		})

		t.Run("With bucket_script doc count", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "count", "field": "select field" },
					{
						"id": "2",
						"type": "bucket_script",
						"pipelineVariables": [
							{ "name": "var1", "pipelineAgg": "3" }
						],
						"settings": { "script": "params.var1 * 1000" }
					}
				]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			assert.Equal(t, "4", firstLevel.Key)
			assert.Equal(t, "date_histogram", firstLevel.Aggregation.Type)

			bucketScriptAgg := firstLevel.Aggregation.Aggs[0]
			assert.Equal(t, "2", bucketScriptAgg.Key)
			plAgg := bucketScriptAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			assert.Equal(t, map[string]interface{}{
				"var1": "_count",
			}, plAgg.BucketPath.(map[string]interface{}))
		})

		t.Run("With Lucene query, should send single multisearch request", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "2" }
				],
				"metrics": [{"type": "avg", "field": "@value", "id": "1" }]
			}`, from, to, 15*time.Second)
			assert.NoError(t, err)
			assert.Len(t, c.multisearchRequests, 1)
			assert.Len(t, c.pplRequest, 0)
		})

		t.Run("With PPL query, should send single PPL request", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"query": "source = index",
				"queryType": "PPL"
			}`, from, to, 15*time.Second)
			assert.Equal(t, "response should have 2 fields but found 0", err.Error())

			assert.Len(t, c.multisearchRequests, 0)
			assert.Len(t, c.pplRequest, 1)
		})

		t.Run("With multi piped PPL query string, should parse request correctly", func(t *testing.T) {
			c := newFakeClient(es.OpenSearch, "1.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"query": "source = index | stats count(response) by timestamp",
				"queryType": "PPL"
			}`, from, to, 15*time.Second)
			assert.Equal(t, "response should have 2 fields but found 0", err.Error())

			req := c.pplRequest[0]
			assert.Equal(t, "source = index | where `@timestamp` >= timestamp('2018-05-15 17:50:00') and `@timestamp` <= timestamp('2018-05-15 17:55:00') | stats count(response) by timestamp", req.Query)
		})
	})
}

func Test_timeSeriesQuery_execute_processTimeSeriesQuery_size_in_search_request(t *testing.T) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	c := newFakeClient(es.OpenSearch, "2.3.0")

	t.Run("size is 0 by default", func(t *testing.T) {
		_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "2" }],
				"metrics": [{"type": "count", "id": "0" }]
			}`, from, to, 15*time.Second)
		assert.NoError(t, err)
		sr := c.multisearchRequests[0].Requests[0]

		assert.Equal(t, 0, sr.Size)
	})

	t.Run("size from settings is ignored", func(t *testing.T) {
		_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "2" }],
				"metrics": [{"type": "count", "id": "0", "settings": {"size": "1337" }}]
			}`, from, to, 15*time.Second)
		assert.NoError(t, err)
		sr := c.multisearchRequests[0].Requests[0]

		assert.Equal(t, 0, sr.Size)
	})
}

type fakeClient struct {
	flavor              es.Flavor
	version             *semver.Version
	timeField           string
	index               string
	multiSearchResponse *es.MultiSearchResponse
	multiSearchError    error
	builder             *es.MultiSearchRequestBuilder
	pplbuilder          *es.PPLRequestBuilder
	multisearchRequests []*es.MultiSearchRequest
	pplRequest          []*es.PPLRequest
	pplResponse         *es.PPLResponse
}

func newFakeClient(flavor es.Flavor, versionString string) *fakeClient {
	version, _ := semver.NewVersion(versionString)

	return &fakeClient{
		flavor:              flavor,
		version:             version,
		timeField:           "@timestamp",
		index:               "[metrics-]YYYY.MM.DD",
		multisearchRequests: make([]*es.MultiSearchRequest, 0),
		multiSearchResponse: &es.MultiSearchResponse{},
		pplRequest:          make([]*es.PPLRequest, 0),
		pplResponse:         &es.PPLResponse{},
	}
}

func (c *fakeClient) EnableDebug() {}

func (c *fakeClient) GetFlavor() es.Flavor {
	return c.flavor
}

func (c *fakeClient) GetVersion() *semver.Version {
	return c.version
}

func (c *fakeClient) GetConfiguredFields() es.ConfiguredFields {
	return es.ConfiguredFields{TimeField: c.timeField}
}

func (c *fakeClient) GetIndex() string {
	return c.index
}

func (c *fakeClient) GetMinInterval(queryInterval string) (time.Duration, error) {
	return 15 * time.Second, nil
}

func (c *fakeClient) ExecuteMultisearch(ctx context.Context, r *es.MultiSearchRequest) (*es.MultiSearchResponse, error) {
	c.multisearchRequests = append(c.multisearchRequests, r)
	return c.multiSearchResponse, c.multiSearchError
}

func (c *fakeClient) MultiSearch() *es.MultiSearchRequestBuilder {
	c.builder = es.NewMultiSearchRequestBuilder(c.flavor, c.version)
	return c.builder
}

func (c *fakeClient) ExecutePPLQuery(ctx context.Context, r *es.PPLRequest) (*es.PPLResponse, error) {
	c.pplRequest = append(c.pplRequest, r)
	return c.pplResponse, c.multiSearchError
}

func (c *fakeClient) PPL() *es.PPLRequestBuilder {
	c.pplbuilder = es.NewPPLRequestBuilder(c.GetIndex())
	return c.pplbuilder
}

func newTsdbQueries(body string) ([]backend.DataQuery, error) {
	return []backend.DataQuery{
		{
			JSON: []byte(body),
		},
	}, nil
}

func executeTsdbQuery(c es.Client, body string, from, to time.Time, minInterval time.Duration) (*backend.QueryDataResponse, error) {
	tsdbQuery := []backend.DataQuery{
		{
			JSON: []byte(body),
			TimeRange: backend.TimeRange{
				From: from,
				To:   to,
			},
		},
	}

	dsSettings := backend.DataSourceInstanceSettings{}
	query := newQueryRequest(c, tsdbQuery, &dsSettings, tsdb.NewIntervalCalculator(&tsdb.IntervalOptions{MinInterval: minInterval}))
	return query.execute(context.Background())
}

func TestTimeSeriesQueryParser(t *testing.T) {
	t.Run("Test time series query parser", func(t *testing.T) {
		t.Run("Should be able to parse Lucene query", func(t *testing.T) {
			body := `{
				"timeField": "@timestamp",
				"query": "@metric:cpu",
				"alias": "{{@hostname}} {{metric}}",
				"metrics": [
					{
						"field": "@value",
						"id": "1",
						"meta": {},
						"settings": {
							"percents": [
								"90"
							]
						},
						"type": "percentiles"
					},
					{
						"type": "count",
						"field": "select field",
						"id": "4",
						"settings": {},
						"meta": {}
					}
				],
				"bucketAggs": [
					{
						"fake": true,
						"field": "@hostname",
						"id": "3",
						"settings": {
							"min_doc_count": 1,
							"order": "desc",
							"orderBy": "_term",
							"size": "10"
						},
						"type": "terms"
					},
					{
						"field": "@timestamp",
						"id": "2",
						"settings": {
							"interval": "5m",
							"min_doc_count": 0,
							"trimEdges": 0
						},
						"type": "date_histogram"
					}
				]
			}`
			tsdbQuery, err := newTsdbQueries(body)
			assert.NoError(t, err)
			queries, err := parse(tsdbQuery)
			assert.NoError(t, err)
			assert.Len(t, queries, 1)

			q := queries[0]

			assert.Equal(t, "@metric:cpu", q.RawQuery)
			assert.Equal(t, "lucene", q.QueryType)
			assert.Equal(t, "{{@hostname}} {{metric}}", q.Alias)

			assert.Len(t, q.Metrics, 2)
			assert.Equal(t, "@value", q.Metrics[0].Field)
			assert.Equal(t, "1", q.Metrics[0].ID)
			assert.Equal(t, "percentiles", q.Metrics[0].Type)
			assert.False(t, q.Metrics[0].Hide)
			assert.Equal(t, "", q.Metrics[0].PipelineAggregate)
			assert.Equal(t, "90", q.Metrics[0].Settings.Get("percents").MustStringArray()[0])

			assert.Equal(t, "select field", q.Metrics[1].Field)
			assert.Equal(t, "4", q.Metrics[1].ID)
			assert.Equal(t, "count", q.Metrics[1].Type)
			assert.False(t, q.Metrics[1].Hide)
			assert.Equal(t, "", q.Metrics[1].PipelineAggregate)
			assert.Empty(t, q.Metrics[1].Settings.MustMap())

			assert.Len(t, q.BucketAggs, 2)
			assert.Equal(t, "@hostname", q.BucketAggs[0].Field)
			assert.Equal(t, "3", q.BucketAggs[0].ID)
			assert.Equal(t, "terms", q.BucketAggs[0].Type)
			assert.Equal(t, int64(1), q.BucketAggs[0].Settings.Get("min_doc_count").MustInt64())
			assert.Equal(t, "desc", q.BucketAggs[0].Settings.Get("order").MustString())
			assert.Equal(t, "_term", q.BucketAggs[0].Settings.Get("orderBy").MustString())
			assert.Equal(t, "10", q.BucketAggs[0].Settings.Get("size").MustString())

			assert.Equal(t, "@timestamp", q.BucketAggs[1].Field)
			assert.Equal(t, "2", q.BucketAggs[1].ID)
			assert.Equal(t, "date_histogram", q.BucketAggs[1].Type)
			assert.Equal(t, "5m", q.BucketAggs[1].Settings.Get("interval").MustString())
			assert.Equal(t, int64(0), q.BucketAggs[1].Settings.Get("min_doc_count").MustInt64())
			assert.Equal(t, int64(0), q.BucketAggs[1].Settings.Get("trimEdges").MustInt64())
		})

		t.Run("Should default queryType to Lucene", func(t *testing.T) {
			body := `{
				"timeField": "@timestamp",
				"query": "*"
			}`
			tsdbQuery, err := newTsdbQueries(body)
			assert.NoError(t, err)
			queries, err := parse(tsdbQuery)
			assert.NoError(t, err)
			assert.Len(t, queries, 1)

			q := queries[0]

			assert.Equal(t, q.RawQuery, "*")
			assert.Equal(t, q.QueryType, "lucene")
		})

		t.Run("Should be able to parse PPL query", func(t *testing.T) {
			body := `{
				"timeField": "@timestamp",
				"query": "source=index",
				"queryType": "PPL"
			}`
			tsdbQuery, err := newTsdbQueries(body)
			assert.NoError(t, err)
			queries, err := parse(tsdbQuery)
			assert.NoError(t, err)
			assert.Len(t, queries, 1)

			q := queries[0]

			assert.Equal(t, "source=index", q.RawQuery)
			assert.Equal(t, "PPL", q.QueryType)
		})
	})
}

func Test_executeTimeSeriesQuery_raw_document_default_size_is_500(t *testing.T) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	c := newFakeClient(es.OpenSearch, "1.0.0")
	_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_document", "settings": {}	}]
			}`, from, to, 15*time.Second)
	assert.NoError(t, err)
	sr := c.multisearchRequests[0].Requests[0]

	assert.Equal(t, 500, sr.Size)
}

func Test_Field_property(t *testing.T) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	t.Run("Should use timeField from datasource when not specified", func(t *testing.T) {
		c := newFakeClient(es.Elasticsearch, "2.0.0")
		_, err := executeTsdbQuery(c, `{
			"timeField": "@timestamp",
			"metrics": [{ "type": "count", "id": "1" }],
			"bucketAggs": [
				{ "type": "date_histogram", "id": "2", "settings": { "min_doc_count": "1" } }
			]
		}`, from, to, 15*time.Second)
		assert.Nil(t, err)

		sr := c.multisearchRequests[0].Requests[0]
		dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)
		assert.Equal(t, "@timestamp", dateHistogramAgg.Field)
	})

	t.Run("Should use field from bucket agg when specified", func(t *testing.T) {
		c := newFakeClient(es.Elasticsearch, "2.0.0")
		_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"metrics": [{ "type": "count", "id": "1" }],
				"bucketAggs": [
					{ "type": "date_histogram", "id": "2", "field": "some_other_field", "settings": { "min_doc_count": "1" } }
				]
			}`, from, to, 15*time.Second)

		assert.Nil(t, err)
		sr := c.multisearchRequests[0].Requests[0]
		dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)
		assert.Equal(t, "some_other_field", dateHistogramAgg.Field)
	})
}

func Test_parse_queryType(t *testing.T) {
	t.Run("returns error when invalid queryType is explicitly provided", func(t *testing.T) {
		c := newFakeClient(es.OpenSearch, "2.0.0")
		_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_document", "settings": {}	}],
				"queryType":"randomWalk"
			}`,
			time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC),
			time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC),
			15*time.Second)

		assert.Error(t, err)
		assert.Empty(t, c.multisearchRequests, 0) // multisearchRequests is a Lucene query
		assert.Empty(t, c.pplRequest, 0)
		assert.Equal(t, `invalid queryType: "randomWalk"`, err.Error())
		var unwrappedError invalidQueryTypeError
		assert.True(t, errors.As(err, &unwrappedError))
	})

	t.Run("returns error when empty string queryType is provided", func(t *testing.T) {
		c := newFakeClient(es.OpenSearch, "2.0.0")
		_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_document", "settings": {}	}],
				"queryType":""
			}`,
			time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC),
			time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC),
			15*time.Second)

		assert.Error(t, err)
		assert.Empty(t, c.multisearchRequests, 0) // multisearchRequests is a Lucene query
		assert.Empty(t, c.pplRequest, 0)
		assert.Equal(t, `invalid queryType: ""`, err.Error())
		var unwrappedError invalidQueryTypeError
		assert.True(t, errors.As(err, &unwrappedError))
	})

	t.Run("defaults to Lucene when no queryType is provided", func(t *testing.T) {
		c := newFakeClient(es.OpenSearch, "2.0.0")
		_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_document", "settings": {}	}]
			}`,
			time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC),
			time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC),
			15*time.Second)

		assert.NoError(t, err)
		assert.Len(t, c.multisearchRequests, 1) // multisearchRequests is a Lucene query
		assert.Len(t, c.pplRequest, 0)
	})
}

func TestSettingsCasting_luceneHandler_processQuery_processTimeSeriesQuery_parses_min_doc_count_as_int_or_string(t *testing.T) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	t.Run("Date Histogram Settings, Correctly transforms date_histogram settings", func(t *testing.T) {
		c := newFakeClient(es.OpenSearch, "2.3.0")
		_, err := executeTsdbQuery(c, `{
				"bucketAggs": [
					{
						"type": "date_histogram",
						"field": "@timestamp",
						"id": "2",
						"settings": {
							"min_doc_count": "1"
						}
					}
				],
				"metrics": [
					{ "id": "1", "type": "average", "field": "@value" },
					{
						"id": "3",
						"type": "serial_diff",
						"field": "1",
						"pipelineAgg": "1",
						"settings": {
							"lag": "1"
						}
					}
				]
			}`, from, to, 15*time.Second)
		assert.Nil(t, err)
		sr := c.multisearchRequests[0].Requests[0]

		dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)

		assert.Equal(t, 1, dateHistogramAgg.MinDocCount)
	})

	t.Run("Date Histogram Settings, Correctly uses already int min_doc_count", func(t *testing.T) {
		c := newFakeClient(es.OpenSearch, "2.3.0")
		_, err := executeTsdbQuery(c, `{
				"bucketAggs": [
					{
						"type": "date_histogram",
						"field": "@timestamp",
						"id": "2",
						"settings": {
							"min_doc_count": 10
						}
					}
				],
				"metrics": [
					{ "id": "1", "type": "average", "field": "@value" },
					{
						"id": "3",
						"type": "serial_diff",
						"field": "1",
						"pipelineAgg": "1",
						"settings": {
							"lag": "1"
						}
					}
				]
			}`, from, to, 15*time.Second)
		assert.Nil(t, err)
		sr := c.multisearchRequests[0].Requests[0]

		dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)

		assert.Equal(t, 10, dateHistogramAgg.MinDocCount)
	})
}

func TestSettingsCasting_luceneHandler_processQuery_processLogsQuery_ignores_any_Group_By_in_UI_and_sets_default_date_histogram(t *testing.T) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	c := newFakeClient(es.OpenSearch, "2.3.0")
	_, err := executeTsdbQuery(c, `{
				"bucketAggs": [
					{
						"type": "histogram",
						"field": "agent.keyword",
						"id": "some other name",
						"settings": {
							"min_doc_count": "1"
						}
					}
				],
				"metrics": [
					{ "id": "1", "type": "logs" }
				]
			}`, from, to, 15*time.Second)
	assert.Nil(t, err)
	sr := c.multisearchRequests[0].Requests[0]

	assert.Equal(t, &es.DateHistogramAgg{
		Field:          "@timestamp",
		Interval:       "$__interval",
		MinDocCount:    0,
		Missing:        nil,
		ExtendedBounds: &es.ExtendedBounds{Min: from.UnixMilli(), Max: to.UnixMilli()},
		Format:         "epoch_millis",
		Offset:         "",
	}, sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg))
}

func Test_trace_list(t *testing.T) {
	// When luceneQueryType = Traces, then the request to OpenSearch includes certain aggs and passes query string and time range
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	c := newFakeClient(es.OpenSearch, "2.3.0")

	_, err := executeTsdbQuery(c, `
		{
		  "alias": "",
		  "bucketAggs": [
			{
			  "field": "@timestamp",
			  "id": "2",
			  "settings": {
				"interval": "auto"
			  },
			  "type": "date_histogram"
			}
		  ],
		  "datasource": {
			"type": "grafana-opensearch-datasource",
			"uid": "a2a05fd1-c06c-4008-b469-720fea03add2"
		  },
		  "format": "table",
		  "luceneQueryType": "Traces",
		  "metrics": [
			{
			  "id": "1",
			  "type": "count"
			}
		  ],
		  "query": "some query here",
		  "queryType": "lucene",
		  "refId": "A",
		  "timeField": "@timestamp",
		  "datasourceId": 2020,
		  "intervalMs": 10000,
		  "maxDataPoints": 1124
		}`, from, to, 15*time.Second)
	require.NoError(t, err)

	require.Len(t, c.multisearchRequests, 1)
	require.Len(t, c.multisearchRequests[0].Requests, 1)
	actualRequest := c.multisearchRequests[0].Requests[0]

	assert.Equal(t, 10, actualRequest.Size)
	assert.Empty(t, actualRequest.Sort)
	assert.Empty(t, actualRequest.CustomProps)

	require.NotNil(t, actualRequest.Query)
	require.NotNil(t, actualRequest.Query.Bool)
	require.Len(t, actualRequest.Query.Bool.MustFilters, 2)
	assert.Equal(t, &es.RangeFilter{
		Key: "startTime",
		Gte: 1526406600000,
		Lte: 1526406900000,
	}, actualRequest.Query.Bool.MustFilters[0])
	assert.Equal(t, &es.QueryStringFilter{
		Query:           "some query here",
		AnalyzeWildcard: true,
	}, actualRequest.Query.Bool.MustFilters[1])

	require.Len(t, actualRequest.Aggs, 1)
	assert.Equal(t, "traces", actualRequest.Aggs[0].Key)
	assert.Equal(t, "terms", actualRequest.Aggs[0].Aggregation.Type)
	assert.Equal(t, &struct {
		Field string            `json:"field"`
		Size  int               `json:"size"`
		Order map[string]string `json:"order"`
	}{
		Field: "traceId",
		Size:  100,
		Order: map[string]string{"_key": "asc"},
	}, actualRequest.Aggs[0].Aggregation.Aggregation)

	require.Len(t, actualRequest.Aggs[0].Aggregation.Aggs, 4)
	assert.Equal(t, &es.Agg{
		Key: "latency",
		Aggregation: &es.AggContainer{
			Type: "max",
			Aggregation: &struct {
				Script struct {
					Source string `json:"source"`
					Lang   string `json:"lang"`
				} `json:"script"`
			}{
				struct {
					Source string `json:"source"`
					Lang   string `json:"lang"`
				}{
					Source: `
                if (doc.containsKey('traceGroupFields.durationInNanos') && !doc['traceGroupFields.durationInNanos'].empty) {
                  return Math.round(doc['traceGroupFields.durationInNanos'].value / 10000) / 100.0
                }
                return 0
                `,
					Lang: "painless"},
			},
		},
	}, actualRequest.Aggs[0].Aggregation.Aggs[0])
	assert.Equal(t, &es.Agg{
		Key: "trace_group",
		Aggregation: &es.AggContainer{
			Type: "terms",
			Aggregation: &struct {
				Field string `json:"field"`
				Size  int    `json:"size"`
			}{
				Field: "traceGroup",
				Size:  1,
			},
		},
	}, actualRequest.Aggs[0].Aggregation.Aggs[1])
	assert.Equal(t, &es.Agg{
		Key: "error_count",
		Aggregation: &es.AggContainer{
			Type:        "filter",
			Aggregation: map[string]map[string]string{"term": {"traceGroupFields.statusCode": "2"}},
		},
	}, actualRequest.Aggs[0].Aggregation.Aggs[2])
	assert.Equal(t, &es.Agg{
		Key: "last_updated",
		Aggregation: &es.AggContainer{
			Type: "max",
			Aggregation: &struct {
				Field string `json:"field"`
			}{Field: "traceGroupFields.endTime"},
		},
	}, actualRequest.Aggs[0].Aggregation.Aggs[3])
}
