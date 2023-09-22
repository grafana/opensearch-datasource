package client

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/Masterminds/semver"
	"github.com/bitly/go-simplejson"
	"github.com/grafana/opensearch-datasource/pkg/tsdb"
	"github.com/stretchr/testify/assert"
)

func TestSearchRequest(t *testing.T) {
	timeField := "@timestamp"
	t.Run("Given new search request builder for es OpenSearch 1.0.0, When building search request", func(t *testing.T) {
		version, _ := semver.NewVersion("1.0.0")
		b := NewSearchRequestBuilder(OpenSearch, version, tsdb.Interval{Value: 15 * time.Second, Text: "15s"})

		sr, err := b.Build()
		assert.NoError(t, err)

		t.Run("Should have size of zero", func(t *testing.T) {
			assert.Equal(t, 0, sr.Size)
		})

		t.Run("Should have no sorting", func(t *testing.T) {
			assert.Len(t, sr.Sort, 0)
		})

		t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
			body, err := json.Marshal(sr)
			assert.NoError(t, err)
			json, err := simplejson.NewJson(body)
			assert.NoError(t, err)
			assert.Equal(t, 0, json.Get("size").MustInt(500))
			assert.Nil(t, json.Get("sort").Interface())
			assert.Nil(t, json.Get("aggs").Interface())
			assert.Nil(t, json.Get("query").Interface())
		})

		t.Run("When adding size, sort, filters, When building search request", func(t *testing.T) {
			b.Size(200)
			b.Sort("desc", timeField, "boolean")
			filters := b.Query().Bool().Filter()
			filters.AddDateRangeFilter(timeField, DateFormatEpochMS, 10, 5)
			filters.AddQueryStringFilter("test", true)

			sr, err := b.Build()
			assert.NoError(t, err)

			t.Run("Should have correct size", func(t *testing.T) {
				assert.Equal(t, 200, sr.Size)
			})

			t.Run("Should have correct sorting", func(t *testing.T) {
				assert.Len(t, sr.Sort, 1)
				sort, ok := sr.Sort[0][timeField]
				assert.True(t, ok)
				assert.Equal(t, "desc", sort["order"])
				assert.Equal(t, "boolean", sort["unmapped_type"])
			})

			t.Run("Should have range filter", func(t *testing.T) {
				f, ok := sr.Query.Bool.Filters[0].(*RangeFilter)
				assert.True(t, ok)
				assert.Equal(t, int64(5), f.Gte)
				assert.Equal(t, int64(10), f.Lte)
				assert.Equal(t, "epoch_millis", f.Format)
			})

			t.Run("Should have query string filter", func(t *testing.T) {
				f, ok := sr.Query.Bool.Filters[1].(*QueryStringFilter)
				assert.True(t, ok)
				assert.Equal(t, "test", f.Query)
				assert.True(t, f.AnalyzeWildcard)
			})
		})

		t.Run("When adding doc value field", func(t *testing.T) {
			b.AddDocValueField(timeField)

			t.Run("should set correct props", func(t *testing.T) {
				assert.Nil(t, b.customProps["fields"])

				scriptFields, ok := b.customProps["script_fields"].(map[string]interface{})
				assert.True(t, ok)
				assert.Len(t, scriptFields, 0)

				docValueFields, ok := b.customProps["docvalue_fields"].([]string)
				assert.True(t, ok)
				assert.Len(t, docValueFields, 1)
				assert.Equal(t, timeField, docValueFields[0])
			})

			t.Run("When building search request", func(t *testing.T) {
				sr, err := b.Build()
				assert.NoError(t, err)

				t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
					body, err := json.Marshal(sr)
					assert.NoError(t, err)
					json, err := simplejson.NewJson(body)
					assert.NoError(t, err)

					scriptFields, err := json.Get("script_fields").Map()
					assert.NoError(t, err)
					assert.Len(t, scriptFields, 0)

					_, err = json.Get("fields").StringArray()
					assert.Error(t, err)

					docValueFields, err := json.Get("docvalue_fields").StringArray()
					assert.NoError(t, err)
					assert.Len(t, docValueFields, 1)
					assert.Equal(t, docValueFields[0], timeField)
				})
			})
		})

		t.Run("and adding multiple top level aggs, When building search request", func(t *testing.T) {
			aggBuilder := b.Agg()
			aggBuilder.Terms("1", "@hostname", nil)
			aggBuilder.DateHistogram("2", "@timestamp", nil)

			sr, err := b.Build()
			assert.NoError(t, err)

			t.Run("Should have 2 top level aggs", func(t *testing.T) {
				aggs := sr.Aggs
				assert.Len(t, aggs, 2)
				assert.Equal(t, "1", aggs[0].Key)
				assert.Equal(t, "terms", aggs[0].Aggregation.Type)
				assert.Equal(t, "2", aggs[1].Key)
				assert.Equal(t, "date_histogram", aggs[1].Aggregation.Type)
			})

			t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
				body, err := json.Marshal(sr)
				assert.NoError(t, err)
				json, err := simplejson.NewJson(body)
				assert.NoError(t, err)

				assert.Len(t, json.Get("aggs").MustMap(), 2)
				assert.Equal(t, "@hostname", json.GetPath("aggs", "1", "terms", "field").MustString())
				assert.Equal(t, "@timestamp", json.GetPath("aggs", "2", "date_histogram", "field").MustString())
			})
		})

		t.Run("and adding two top level aggs with child agg", func(t *testing.T) {
			aggBuilder := b.Agg()
			aggBuilder.Histogram("1", "@hostname", func(a *HistogramAgg, ib AggBuilder) {
				ib.DateHistogram("2", "@timestamp", nil)
			})
			aggBuilder.Filters("3", func(a *FiltersAggregation, ib AggBuilder) {
				ib.Terms("4", "@test", nil)
			})
		})

		t.Run("and adding top level agg with child agg with child agg", func(t *testing.T) {
			aggBuilder := b.Agg()
			aggBuilder.Terms("1", "@hostname", func(a *TermsAggregation, ib AggBuilder) {
				ib.Terms("2", "@app", func(a *TermsAggregation, ib AggBuilder) {
					ib.DateHistogram("3", "@timestamp", nil)
				})
			})
		})

		t.Run("and adding bucket and metric aggs", func(t *testing.T) {
			aggBuilder := b.Agg()
			aggBuilder.Terms("1", "@hostname", func(a *TermsAggregation, ib AggBuilder) {
				ib.Terms("2", "@app", func(a *TermsAggregation, ib AggBuilder) {
					ib.Metric("4", "avg", "@value", nil)
					ib.DateHistogram("3", "@timestamp", func(a *DateHistogramAgg, ib AggBuilder) {
						ib.Metric("4", "avg", "@value", nil)
						ib.Metric("5", "max", "@value", nil)
					})
				})
			})
		})
	})

	t.Run("Given new search request builder for Elasticsearch 2.0.0", func(t *testing.T) {
		version, _ := semver.NewVersion("2.0.0")
		b := NewSearchRequestBuilder(Elasticsearch, version, tsdb.Interval{Value: 15 * time.Second, Text: "15s"})

		t.Run("When adding doc value field", func(t *testing.T) {
			b.AddDocValueField(timeField)

			t.Run("should set correct props", func(t *testing.T) {
				fields, ok := b.customProps["fields"].([]string)
				assert.True(t, ok)
				assert.Len(t, fields, 2)
				assert.Equal(t, "*", fields[0])
				assert.Equal(t, "_source", fields[1])

				scriptFields, ok := b.customProps["script_fields"].(map[string]interface{})
				assert.True(t, ok)
				assert.Len(t, scriptFields, 0)

				fieldDataFields, ok := b.customProps["fielddata_fields"].([]string)
				assert.True(t, ok)
				assert.Len(t, fieldDataFields, 1)
				assert.Equal(t, timeField, fieldDataFields[0])
			})
		})
	})
}

func TestMultiSearchRequest(t *testing.T) {
	t.Run("When adding one search request, When building search request should contain one search request", func(t *testing.T) {
		version, _ := semver.NewVersion("1.0.0")
		b := NewMultiSearchRequestBuilder(OpenSearch, version)
		b.Search(tsdb.Interval{Value: 15 * time.Second, Text: "15s"})

		mr, err := b.Build()
		assert.NoError(t, err)
		assert.Len(t, mr.Requests, 1)
	})

	t.Run("When adding two search requests, When building search request should contain two search requests", func(t *testing.T) {
		version, _ := semver.NewVersion("1.0.0")
		b := NewMultiSearchRequestBuilder(OpenSearch, version)
		b.Search(tsdb.Interval{Value: 15 * time.Second, Text: "15s"})
		b.Search(tsdb.Interval{Value: 15 * time.Second, Text: "15s"})

		mr, err := b.Build()
		assert.NoError(t, err)
		assert.Len(t, mr.Requests, 2)
	})
}

func Test_building_search_request(t *testing.T) {
	t.Run("Should have 1 top level agg and one child agg", func(t *testing.T) {
		version, _ := semver.NewVersion("1.0.0")
		b := NewSearchRequestBuilder(OpenSearch, version, tsdb.Interval{Value: 15 * time.Second, Text: "15s"})
		aggBuilder := b.Agg()
		aggBuilder.Terms("1", "@hostname", func(a *TermsAggregation, ib AggBuilder) {
			ib.DateHistogram("2", "@timestamp", nil)
		})

		sr, err := b.Build()
		assert.NoError(t, err)

		aggs := sr.Aggs
		assert.Len(t, aggs, 1)

		topAgg := aggs[0]
		assert.Equal(t, "1", topAgg.Key)
		assert.Equal(t, "terms", topAgg.Aggregation.Type)
		assert.Len(t, topAgg.Aggregation.Aggs, 1)

		childAgg := aggs[0].Aggregation.Aggs[0]
		assert.Equal(t, "2", childAgg.Key)
		assert.Equal(t, "date_histogram", childAgg.Aggregation.Type)

		t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
			body, err := json.Marshal(sr)
			assert.NoError(t, err)
			json, err := simplejson.NewJson(body)
			assert.NoError(t, err)

			assert.Len(t, json.Get("aggs").MustMap(), 1)
			firstLevelAgg := json.GetPath("aggs", "1")
			secondLevelAgg := firstLevelAgg.GetPath("aggs", "2")
			assert.Equal(t, "@hostname", firstLevelAgg.GetPath("terms", "field").MustString())
			assert.Equal(t, "@timestamp", secondLevelAgg.GetPath("date_histogram", "field").MustString())
		})
	})

	t.Run("adding two top level aggs with child agg, Should have 2 top level aggs with one child agg each", func(t *testing.T) {
		version, _ := semver.NewVersion("1.0.0")
		b := NewSearchRequestBuilder(OpenSearch, version, tsdb.Interval{Value: 15 * time.Second, Text: "15s"})
		aggBuilder := b.Agg()
		aggBuilder.Histogram("1", "@hostname", func(a *HistogramAgg, ib AggBuilder) {
			ib.DateHistogram("2", "@timestamp", nil)
		})
		aggBuilder.Filters("3", func(a *FiltersAggregation, ib AggBuilder) {
			ib.Terms("4", "@test", nil)
		})

		sr, err := b.Build()
		assert.NoError(t, err)

		aggs := sr.Aggs
		assert.Len(t, aggs, 2)

		topAggOne := aggs[0]
		assert.Equal(t, "1", topAggOne.Key)
		assert.Equal(t, "histogram", topAggOne.Aggregation.Type)
		assert.Len(t, topAggOne.Aggregation.Aggs, 1)

		topAggOnechildAgg := topAggOne.Aggregation.Aggs[0]
		assert.Equal(t, "2", topAggOnechildAgg.Key)
		assert.Equal(t, "date_histogram", topAggOnechildAgg.Aggregation.Type)

		topAggTwo := aggs[1]
		assert.Equal(t, "3", topAggTwo.Key)
		assert.Equal(t, "filters", topAggTwo.Aggregation.Type)
		assert.Len(t, topAggTwo.Aggregation.Aggs, 1)

		topAggTwochildAgg := topAggTwo.Aggregation.Aggs[0]
		assert.Equal(t, "4", topAggTwochildAgg.Key)
		assert.Equal(t, "terms", topAggTwochildAgg.Aggregation.Type)

		t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
			body, err := json.Marshal(sr)
			assert.NoError(t, err)
			json, err := simplejson.NewJson(body)
			assert.NoError(t, err)

			topAggOne := json.GetPath("aggs", "1")
			assert.Equal(t, "@hostname", topAggOne.GetPath("histogram", "field").MustString())
			topAggOnechildAgg := topAggOne.GetPath("aggs", "2")
			assert.Equal(t, "@timestamp", topAggOnechildAgg.GetPath("date_histogram", "field").MustString())

			topAggTwo := json.GetPath("aggs", "3")
			topAggTwochildAgg := topAggTwo.GetPath("aggs", "4")
			assert.Len(t, topAggTwo.GetPath("filters").MustArray(), 0)
			assert.Equal(t, "@test", topAggTwochildAgg.GetPath("terms", "field").MustString())
		})
	})

	t.Run("and adding top level agg with child agg with child agg, Should have 1 top level agg with one child having a child", func(t *testing.T) {
		version, _ := semver.NewVersion("1.0.0")
		b := NewSearchRequestBuilder(OpenSearch, version, tsdb.Interval{Value: 15 * time.Second, Text: "15s"})
		aggBuilder := b.Agg()
		aggBuilder.Terms("1", "@hostname", func(a *TermsAggregation, ib AggBuilder) {
			ib.Terms("2", "@app", func(a *TermsAggregation, ib AggBuilder) {
				ib.DateHistogram("3", "@timestamp", nil)
			})
		})
		sr, err := b.Build()
		assert.NoError(t, err)
		aggs := sr.Aggs
		assert.Len(t, aggs, 1)

		topAgg := aggs[0]
		assert.Equal(t, "1", topAgg.Key)
		assert.Equal(t, "terms", topAgg.Aggregation.Type)
		assert.Len(t, topAgg.Aggregation.Aggs, 1)

		childAgg := topAgg.Aggregation.Aggs[0]
		assert.Equal(t, "2", childAgg.Key)
		assert.Equal(t, "terms", childAgg.Aggregation.Type)

		childChildAgg := childAgg.Aggregation.Aggs[0]
		assert.Equal(t, "3", childChildAgg.Key)
		assert.Equal(t, "date_histogram", childChildAgg.Aggregation.Type)

		t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
			body, err := json.Marshal(sr)
			assert.NoError(t, err)
			json, err := simplejson.NewJson(body)
			assert.NoError(t, err)

			topAgg := json.GetPath("aggs", "1")
			assert.Equal(t, "@hostname", topAgg.GetPath("terms", "field").MustString())

			childAgg := topAgg.GetPath("aggs", "2")
			assert.Equal(t, "@app", childAgg.GetPath("terms", "field").MustString())

			childChildAgg := childAgg.GetPath("aggs", "3")
			assert.Equal(t, "@timestamp", childChildAgg.GetPath("date_histogram", "field").MustString())
		})
	})
}

func Test_OpenSearch_search_request_builder_marshals_to_correct_json(t *testing.T) {
	timeField := "@timestamp"
	version, _ := semver.NewVersion("1.0.0")

	b := NewSearchRequestBuilder(OpenSearch, version, tsdb.Interval{Value: 15 * time.Second, Text: "15s"})
	b.Size(200)
	b.Sort("desc", timeField, "boolean")
	filters := b.Query().Bool().Filter()
	filters.AddDateRangeFilter(timeField, DateFormatEpochMS, 10, 5)
	filters.AddQueryStringFilter("test", true)

	sr, err := b.Build()
	assert.NoError(t, err)

	body, err := json.Marshal(sr)
	assert.NoError(t, err)

	assert.JSONEq(t, `{
	   "query":{
		  "bool":{
			 "filter":[
				{
				   "range":{
					  "@timestamp":{
						 "format":"epoch_millis",
						 "gte":5,
						 "lte":10
					  }
				   }
				},
				{
				   "query_string":{
					  "analyze_wildcard":true,
					  "query":"test"
				   }
				}
			 ]
		  }
	   },
	   "size":200,
	   "sort":[
		  {
			 "@timestamp":{
				"order":"desc",
				"unmapped_type":"boolean"
			 }
		  }
	   ]
	}`, string(body))
}
