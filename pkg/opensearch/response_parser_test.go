// cSpell:disable
// disabling for the entire file
package opensearch

import (
	"encoding/json"
	"sort"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/grafana/opensearch-datasource/pkg/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type tsdbQuery struct {
	refId string
	body  string
}

func createDataQueriesForTests(tsdbQueries []tsdbQuery) []backend.DataQuery {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	dataQueries := []backend.DataQuery{}

	for _, tsdbQuery := range tsdbQueries {
		dataQueries = append(dataQueries, backend.DataQuery{
			JSON:  []byte(tsdbQuery.body),
			RefID: tsdbQuery.refId,
			TimeRange: backend.TimeRange{
				From: from,
				To:   to,
			},
		})
	}
	return dataQueries
}

func newResponseParserForTest(tsdbQueries []tsdbQuery, responseBody string, debugInfo *client.SearchDebugInfo, configuredFields client.ConfiguredFields, dsSettings *backend.DataSourceInstanceSettings) (*responseParser, error) {
	dataQueries := createDataQueriesForTests(tsdbQueries)
	var response client.MultiSearchResponse
	err := json.Unmarshal([]byte(responseBody), &response)
	if err != nil {
		return nil, err
	}

	queries, err := parse(dataQueries)
	if err != nil {
		return nil, err
	}

	return newResponseParser(response.Responses, queries, debugInfo, configuredFields, dsSettings), nil
}

func Test_ResponseParser_test(t *testing.T) {
	t.Run("Simple query and count", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
			   "timeField":"@timestamp",
			   "metrics":[
				  {
					 "type":"count",
					 "id":"1"
				  }
			   ],
			   "bucketAggs":[
				  {
					 "type":"date_histogram",
					 "field":"@timestamp",
					 "id":"2"
				  }
			   ]
			}`,
		}}
		response := `{
        "responses": [
          {
            "aggregations": {
              "2": {
                "buckets": [
                  {
                    "doc_count": 10,
                    "key": 1000
                  },
                  {
                    "doc_count": 15,
                    "key": 2000
                  }
                ]
              }
            }
          }
        ]
			}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		assert.Len(t, queryRes.Frames, 1)
		series := queryRes.Frames[0]

		require.Len(t, series.Fields, 2)
		assert.Equal(t, "Count", series.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, series.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *series.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *series.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, series.Fields[1].Len())
		assert.EqualValues(t, 10, *series.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 15, *series.Fields[1].At(1).(*float64))
	})

	t.Run("Simple query count & avg aggregation", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
							"timeField": "@timestamp",
							"metrics": [{ "type": "count", "id": "1" }, {"type": "avg", "field": "value", "id": "2" }],
				 "bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "3" }]
						}`,
		}}
		response := `{
			       "responses": [
			         {
			           "aggregations": {
			             "3": {
			               "buckets": [
			                 {
			                   "2": { "value": 88 },
			                   "doc_count": 10,
			                   "key": 1000
			                 },
			                 {
			                   "2": { "value": 99 },
			                   "doc_count": 15,
			                   "key": 2000
			                 }
			               ]
			             }
			           }
			         }
			       ]
						}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		assert.Len(t, queryRes.Frames, 2)

		seriesOne := queryRes.Frames[0]
		require.Len(t, seriesOne.Fields, 2)
		assert.Equal(t, "Count", seriesOne.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, seriesOne.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesOne.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesOne.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesOne.Fields[1].Len())
		assert.EqualValues(t, 10, *seriesOne.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 15, *seriesOne.Fields[1].At(1).(*float64))

		seriesTwo := queryRes.Frames[1]
		require.Len(t, seriesTwo.Fields, 2)
		assert.Equal(t, "Average value", seriesTwo.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, seriesTwo.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesTwo.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesTwo.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesTwo.Fields[1].Len())
		assert.EqualValues(t, 88, *seriesTwo.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 99, *seriesTwo.Fields[1].At(1).(*float64))
	})

	t.Run("Query average and derivative", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					"timeField": "@timestamp",
					"metrics": [{"type": "avg", "field": "rating", "id": "1" }, {"type": "derivative", "field":"1", "id": "3"}],
		 "bucketAggs": [{ "type": "date_histogram", "field": "release_date", "id": "2" }]
				}`,
		}}
		response := `{
        "responses": [
          {
            "aggregations": {
              "2": {
                "buckets": [
                  {
                    "1": { "value": 6.34 },
                    "key": 1000,
                    "doc_count": 200
                  },
                  {
                    "1": { "value": 6.13 },
					"3": {"value": -0.21 },
                    "key": 2000,
                    "doc_count": 369
                  }
                ]
              }
            }
          }
        ]
			}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		responseForA, ok := result.Responses["A"]
		require.True(t, ok)
		require.Len(t, responseForA.Frames, 2)

		expectedFrame1 := data.NewFrame("",
			data.NewField("Time", nil, []*time.Time{utils.Pointer(time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC)), utils.Pointer(time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC))}),
			data.NewField(
				"Value",
				nil,
				[]*float64{utils.Pointer(6.34), utils.Pointer(6.13)},
			).SetConfig(&data.FieldConfig{DisplayNameFromDS: "Average rating"}),
		).SetMeta(&data.FrameMeta{Type: "timeseries-multi"})
		if diff := cmp.Diff(expectedFrame1, responseForA.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}

		expectedFrame2 := data.NewFrame("",
			data.NewField("Time", nil, []*time.Time{utils.Pointer(time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC))}),
			data.NewField(
				"Value",
				nil,
				[]*float64{utils.Pointer(-0.21)},
			).SetConfig(&data.FieldConfig{DisplayNameFromDS: "Derivative Average rating"}),
		).SetMeta(&data.FrameMeta{Type: "timeseries-multi"})
		if diff := cmp.Diff(expectedFrame2, responseForA.Frames[1], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Single group by query one metric", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "count", "id": "1" }],
		 "bucketAggs": [
						{ "type": "terms", "field": "host", "id": "2" },
						{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
					]
				}`,
		}}
		response := `{
		   "responses": [
			 {
			   "aggregations": {
				 "2": {
				   "buckets": [
					 {
					   "3": {
						 "buckets": [{ "doc_count": 1, "key": 1000 }, { "doc_count": 3, "key": 2000 }]
					   },
					   "doc_count": 4,
					   "key": "server1"
					 },
					 {
					   "3": {
						 "buckets": [{ "doc_count": 2, "key": 1000 }, { "doc_count": 8, "key": 2000 }]
					   },
					   "doc_count": 10,
					   "key": "server2"
					 }
				   ]
				 }
			   }
			 }
		   ]
				}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		assert.Len(t, queryRes.Frames, 2)
		seriesOne := queryRes.Frames[0]
		assert.Equal(t, "server1", seriesOne.Fields[1].Config.DisplayNameFromDS)
		require.Len(t, seriesOne.Fields, 2)
		require.Equal(t, 2, seriesOne.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesOne.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesOne.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesOne.Fields[1].Len())
		assert.EqualValues(t, 1, *seriesOne.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 3, *seriesOne.Fields[1].At(1).(*float64))

		seriesTwo := queryRes.Frames[1]
		assert.Equal(t, "server2", seriesTwo.Fields[1].Config.DisplayNameFromDS)
		require.Len(t, seriesTwo.Fields, 2)
		require.Equal(t, 2, seriesTwo.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesTwo.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesTwo.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesTwo.Fields[1].Len())
		assert.EqualValues(t, 2, *seriesTwo.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 8, *seriesTwo.Fields[1].At(1).(*float64))
	})

	t.Run("Single group by query two metrics", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
				"timeField": "@timestamp",
				"metrics": [{ "type": "count", "id": "1" }, { "type": "avg", "field": "@value", "id": "4" }],
	 "bucketAggs": [
					{ "type": "terms", "field": "host", "id": "2" },
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				]
			}`,
		}}
		response := `{
		   "responses": [
			 {
			   "aggregations": {
				 "2": {
				   "buckets": [
					 {
					   "3": {
						 "buckets": [
						   { "4": { "value": 10 }, "doc_count": 1, "key": 1000 },
						   { "4": { "value": 12 }, "doc_count": 3, "key": 2000 }
						 ]
					   },
					   "doc_count": 4,
					   "key": "server1"
					 },
					 {
					   "3": {
						 "buckets": [
						   { "4": { "value": 20 }, "doc_count": 1, "key": 1000 },
						   { "4": { "value": 32 }, "doc_count": 3, "key": 2000 }
						 ]
					   },
					   "doc_count": 10,
					   "key": "server2"
					 }
				   ]
				 }
			   }
			 }
		   ]
				}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		assert.Len(t, queryRes.Frames, 4)
		seriesOne := queryRes.Frames[0]
		assert.Equal(t, "server1 Count", seriesOne.Fields[1].Config.DisplayNameFromDS)
		require.Len(t, seriesOne.Fields, 2)
		require.Equal(t, 2, seriesOne.Fields[0].Len())
		assert.EqualValues(t, 1, *seriesOne.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 3, *seriesOne.Fields[1].At(1).(*float64))
		require.Equal(t, 2, seriesOne.Fields[1].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesOne.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesOne.Fields[0].At(1).(*time.Time))

		seriesTwo := queryRes.Frames[1]
		assert.Equal(t, "server1 Average @value", seriesTwo.Fields[1].Config.DisplayNameFromDS)
		require.Len(t, seriesTwo.Fields, 2)
		require.Equal(t, 2, seriesTwo.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesTwo.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesTwo.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesTwo.Fields[1].Len())
		assert.EqualValues(t, 10, *seriesTwo.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 12, *seriesTwo.Fields[1].At(1).(*float64))

		seriesThree := queryRes.Frames[2]
		assert.Equal(t, "server2 Count", seriesThree.Fields[1].Config.DisplayNameFromDS)
		require.Len(t, seriesThree.Fields, 2)
		require.Equal(t, 2, seriesThree.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesThree.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesThree.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesThree.Fields[1].Len())
		assert.EqualValues(t, 1, *seriesThree.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 3, *seriesThree.Fields[1].At(1).(*float64))

		seriesFour := queryRes.Frames[3]
		assert.Equal(t, "server2 Average @value", seriesFour.Fields[1].Config.DisplayNameFromDS)
		require.Len(t, seriesFour.Fields, 2)
		require.Equal(t, 2, seriesFour.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesFour.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesFour.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesFour.Fields[1].Len())
		assert.EqualValues(t, 20, *seriesFour.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 32, *seriesFour.Fields[1].At(1).(*float64))
	})

	t.Run("Multiple group by query with two metrics", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
				"timeField": "@timestamp",
				"metrics": [{"id": "1", "type": "count"}, {"id": "4", "type": "max", "field": "DistanceMiles"}],
	      "bucketAggs": [{"field": "DestCityName", "id": "3", "type": "terms"}, {"field": "FlightDelayType", "id": "2", "type": "terms"}]
			}`,
		}}
		response := `{
			"responses": [
				{
					"aggregations": {
						"3": {
							"buckets": [
								{
									"2": {
										"buckets": [
											{
												"4": {
													"value": 5640.1
												},
												"key": "Weather Delay",
												"doc_count": 10
											},
											{
												"4": {
													"value": 5624.2
												},
												"key": "Security Delay",
												"doc_count": 15
											}
										]
									},
									"key": "Zurich",
									"doc_count": 691
								},
								{
									"2": {
										"buckets": [
											{
												"4": {
													"value": 8245.1
												},
												"key": "Weather Delay",
												"doc_count": 9
											},
											{
												"4": {
													"value": 8300.4
												},
												"key": "Security Delay",
												"doc_count": 8
											}
										]
									},
									"key": "Xi'an",
									"doc_count": 526
								}
							]
						}
					}
				}
			]
		}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		assert.Len(t, queryRes.Frames, 1)
		frame := queryRes.Frames[0]
		require.Len(t, frame.Fields, 4)

		assert.Equal(t, "DestCityName", frame.Fields[0].Name)
		assert.Equal(t, "FlightDelayType", frame.Fields[1].Name)
		assert.Equal(t, "Count", frame.Fields[2].Name)
		assert.Equal(t, "Max", frame.Fields[3].Name)

		assert.Equal(t, "Zurich", *frame.Fields[0].At(0).(*string))
		assert.Equal(t, "Weather Delay", *frame.Fields[1].At(0).(*string))
		assert.Equal(t, float64(10), *frame.Fields[2].At(0).(*float64))
		assert.Equal(t, float64(5640.1), *frame.Fields[3].At(0).(*float64))

		assert.Equal(t, "Zurich", *frame.Fields[0].At(1).(*string))
		assert.Equal(t, "Security Delay", *frame.Fields[1].At(1).(*string))
		assert.Equal(t, float64(15), *frame.Fields[2].At(1).(*float64))
		assert.Equal(t, float64(5624.2), *frame.Fields[3].At(1).(*float64))

		assert.Equal(t, "Xi'an", *frame.Fields[0].At(2).(*string))
		assert.Equal(t, "Weather Delay", *frame.Fields[1].At(2).(*string))
		assert.Equal(t, float64(9), *frame.Fields[2].At(2).(*float64))
		assert.Equal(t, float64(8245.1), *frame.Fields[3].At(2).(*float64))

		assert.Equal(t, "Xi'an", *frame.Fields[0].At(3).(*string))
		assert.Equal(t, "Security Delay", *frame.Fields[1].At(3).(*string))
		assert.Equal(t, float64(8), *frame.Fields[2].At(3).(*float64))
		assert.Equal(t, float64(8300.4), *frame.Fields[3].At(3).(*float64))
	})

	t.Run("With percentiles", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "percentiles", "settings": { "percents": [75, 90] }, "id": "1" }],
		 "bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "3" }]
				}`,
		}}
		response := `{
		   "responses": [
			 {
			   "aggregations": {
				 "3": {
				   "buckets": [
					 {
					   "1": { "values": { "75": 3.3, "90": 5.5 } },
					   "doc_count": 10,
					   "key": 1000
					 },
					 {
					   "1": { "values": { "75": 2.3, "90": 4.5 } },
					   "doc_count": 15,
					   "key": 2000
					 }
				   ]
				 }
			   }
			 }
		   ]
				}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		assert.Len(t, queryRes.Frames, 2)
		seriesOne := queryRes.Frames[0]
		require.Len(t, seriesOne.Fields, 2)
		assert.Equal(t, "p75", seriesOne.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, seriesOne.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesOne.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesOne.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesOne.Fields[1].Len())
		assert.EqualValues(t, 3.3, *seriesOne.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 2.3, *seriesOne.Fields[1].At(1).(*float64))

		seriesTwo := queryRes.Frames[1]
		require.Len(t, seriesTwo.Fields, 2)
		assert.Equal(t, "p90", seriesTwo.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, seriesTwo.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesTwo.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesTwo.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesTwo.Fields[1].Len())
		assert.EqualValues(t, 5.5, *seriesTwo.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 4.5, *seriesTwo.Fields[1].At(1).(*float64))
	})

	t.Run("With extended stats", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "extended_stats", "meta": { "max": true, "std_deviation_bounds_upper": true, "std_deviation_bounds_lower": true }, "id": "1" }],
		 "bucketAggs": [
						{ "type": "terms", "field": "host", "id": "3" },
						{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
					]
				}`,
		}}
		response := `{
		   "responses": [
			 {
			   "aggregations": {
				 "3": {
				   "buckets": [
					 {
					   "key": "server1",
					   "4": {
						 "buckets": [
						   {
							 "1": {
							   "max": 10.2,
							   "min": 5.5,
							   "std_deviation_bounds": { "upper": 3, "lower": -2 }
							 },
							 "doc_count": 10,
							 "key": 1000
						   }
						 ]
					   }
					 },
					 {
					   "key": "server2",
					   "4": {
						 "buckets": [
						   {
							 "1": {
							   "max": 15.5,
							   "min": 3.4,
							   "std_deviation_bounds": { "upper": 4, "lower": -1 }
							 },
							 "doc_count": 10,
							 "key": 1000
						   }
						 ]
					   }
					 }
				   ]
				 }
			   }
			 }
		   ]
				}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		require.Len(t, queryRes.Frames, 6)

		seriesOne := queryRes.Frames[0]
		require.Len(t, seriesOne.Fields, 2)
		assert.Equal(t, "server1 Max", seriesOne.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 1, seriesOne.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesOne.Fields[0].At(0).(*time.Time))
		require.Equal(t, 1, seriesOne.Fields[1].Len())
		assert.EqualValues(t, 10.2, *seriesOne.Fields[1].At(0).(*float64))

		seriesTwo := queryRes.Frames[1]
		require.Len(t, seriesTwo.Fields, 2)
		assert.Equal(t, "server1 Std Dev Lower", seriesTwo.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 1, seriesTwo.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesTwo.Fields[0].At(0).(*time.Time))
		require.Equal(t, 1, seriesTwo.Fields[1].Len())
		assert.EqualValues(t, -2, *seriesTwo.Fields[1].At(0).(*float64))

		seriesThree := queryRes.Frames[2]
		require.Len(t, seriesThree.Fields, 2)
		assert.Equal(t, "server1 Std Dev Upper", seriesThree.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 1, seriesThree.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesThree.Fields[0].At(0).(*time.Time))
		require.Equal(t, 1, seriesThree.Fields[1].Len())
		assert.EqualValues(t, 3, *seriesThree.Fields[1].At(0).(*float64))

		seriesFour := queryRes.Frames[3]
		assert.Equal(t, "server2 Max", seriesFour.Fields[1].Config.DisplayNameFromDS)
		require.Len(t, seriesFour.Fields, 2)
		require.Equal(t, 1, seriesFour.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesFour.Fields[0].At(0).(*time.Time))
		require.Equal(t, 1, seriesFour.Fields[1].Len())
		assert.EqualValues(t, 15.5, *seriesFour.Fields[1].At(0).(*float64))

		seriesFive := queryRes.Frames[4]
		require.Len(t, seriesFive.Fields, 2)
		assert.Equal(t, "server2 Std Dev Lower", seriesFive.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 1, seriesFive.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesFive.Fields[0].At(0).(*time.Time))
		require.Equal(t, 1, seriesFive.Fields[1].Len())
		assert.EqualValues(t, -1, *seriesFive.Fields[1].At(0).(*float64))

		seriesSix := queryRes.Frames[5]
		require.Len(t, seriesSix.Fields, 2)
		assert.Equal(t, "server2 Std Dev Upper", seriesSix.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 1, seriesSix.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesSix.Fields[0].At(0).(*time.Time))
		require.Equal(t, 1, seriesSix.Fields[1].Len())
		assert.EqualValues(t, 4, *seriesSix.Fields[1].At(0).(*float64))
	})

	t.Run("Single group by with alias pattern", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					"timeField": "@timestamp",
					"alias": "{{term @host}} {{metric}} and {{not_exist}} {{@host}}",
					"metrics": [{ "type": "count", "id": "1" }],
		 "bucketAggs": [
						{ "type": "terms", "field": "@host", "id": "2" },
						{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
					]
				}`,
		}}
		response := `{
		   "responses": [
			 {
			   "aggregations": {
				 "2": {
				   "buckets": [
					 {
					   "3": {
						 "buckets": [{ "doc_count": 1, "key": 1000 }, { "doc_count": 3, "key": 2000 }]
					   },
					   "doc_count": 4,
					   "key": "server1"
					 },
					 {
					   "3": {
						 "buckets": [{ "doc_count": 2, "key": 1000 }, { "doc_count": 8, "key": 2000 }]
					   },
					   "doc_count": 10,
					   "key": "server2"
					 },
					 {
					   "3": {
						 "buckets": [{ "doc_count": 2, "key": 1000 }, { "doc_count": 8, "key": 2000 }]
					   },
					   "doc_count": 10,
					   "key": 0
					 }
				   ]
				 }
			   }
			 }
		   ]
		}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		assert.Len(t, queryRes.Frames, 3)

		seriesOne := queryRes.Frames[0]
		require.Len(t, seriesOne.Fields, 2)
		assert.Equal(t, "server1 Count and {{not_exist}} server1", seriesOne.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, seriesOne.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesOne.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesOne.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesOne.Fields[1].Len())
		assert.EqualValues(t, 1, *seriesOne.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 3, *seriesOne.Fields[1].At(1).(*float64))

		seriesTwo := queryRes.Frames[1]
		require.Len(t, seriesTwo.Fields, 2)
		assert.Equal(t, "server2 Count and {{not_exist}} server2", seriesTwo.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, seriesTwo.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesTwo.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesTwo.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesTwo.Fields[1].Len())
		assert.EqualValues(t, 2, *seriesTwo.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 8, *seriesTwo.Fields[1].At(1).(*float64))

		seriesThree := queryRes.Frames[2]
		require.Len(t, seriesThree.Fields, 2)
		assert.Equal(t, "0 Count and {{not_exist}} 0", seriesThree.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, seriesThree.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesThree.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesThree.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesThree.Fields[1].Len())
		assert.EqualValues(t, 2, *seriesThree.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 8, *seriesThree.Fields[1].At(1).(*float64))
	})

	t.Run("Multiple queries with aliases", func(t *testing.T) {
		targets := []tsdbQuery{
			{
				refId: "A",
				body: `{
					"timeField": "@timestamp",
					"alias": "alias1",
					"metrics": [{ "type": "count", "id": "1" }],
		 "bucketAggs": [
						{ "type": "terms", "field": "@host", "id": "2" },
						{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
					]
				}`,
			},
			{
				refId: "B",
				body: `{
					"timeField": "@timestamp",
					"alias": "alias2",
					"metrics": [{ "type": "count", "id": "1" }],
		 "bucketAggs": [
						{ "type": "terms", "field": "@ipaddress", "id": "2" },
						{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
					]
				}`,
			}}
		response := `{
			"responses": [
				{
					"aggregations": {
						"2": {
							"buckets": [
								{
									"3": {
										"buckets": [
											{
												"doc_count": 1,
												"key": 1000
											},
											{
												"doc_count": 3,
												"key": 2000
											}
										]
									},
									"doc_count": 4,
									"key": "server1"
								}
							]
						}
					}
				},
				{
					"aggregations": {
						"2": {
							"buckets": [
								{
									"3": {
										"buckets": [
											{
												"doc_count": 2,
												"key": 1000
											},
											{
												"doc_count": 8,
												"key": 2000
											}
										]
									},
									"doc_count": 10,
									"key": "server2"
								}
							]
						}
					}
				}
			]
		}
		`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 2)

		queryResA := result.Responses["A"]
		assert.NotNil(t, queryResA)
		assert.Len(t, queryResA.Frames, 1)

		queryASeries := queryResA.Frames[0]
		require.Len(t, queryASeries.Fields, 2)
		assert.Equal(t, "alias1", queryASeries.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, queryASeries.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *queryASeries.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *queryASeries.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, queryASeries.Fields[1].Len())
		assert.EqualValues(t, 1, *queryASeries.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 3, *queryASeries.Fields[1].At(1).(*float64))

		queryResB := result.Responses["B"]
		assert.NotNil(t, queryResB)
		assert.Len(t, queryResB.Frames, 1)

		queryBSeries := queryResB.Frames[0]
		require.Len(t, queryBSeries.Fields, 2)
		assert.Equal(t, "alias2", queryBSeries.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, queryBSeries.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *queryBSeries.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *queryBSeries.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, queryBSeries.Fields[1].Len())
		assert.EqualValues(t, 2, *queryBSeries.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 8, *queryBSeries.Fields[1].At(1).(*float64))
	})

	t.Run("Histogram response", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "count", "id": "1" }],
		 "bucketAggs": [{ "type": "histogram", "field": "bytes", "id": "3" }]
				}`,
		}}
		response := `{
		   "responses": [
			 {
			   "aggregations": {
				 "3": {
				   "buckets": [{ "doc_count": 1, "key": 1000 }, { "doc_count": 3, "key": 2000 }, { "doc_count": 2, "key": 3000 }]
				 }
			   }
			 }
		   ]
				}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		assert.Len(t, queryRes.Frames, 1)

		frames := queryRes.Frames[0]
		require.Len(t, frames.Fields, 2)
		require.Equal(t, 3, frames.Fields[0].Len())
		assert.Equal(t, float64(1000), *frames.Fields[0].At(0).(*float64))
		assert.Equal(t, float64(2000), *frames.Fields[0].At(1).(*float64))
		assert.Equal(t, float64(3000), *frames.Fields[0].At(2).(*float64))
		require.Equal(t, 3, frames.Fields[1].Len())
		assert.EqualValues(t, 1, *frames.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 3, *frames.Fields[1].At(1).(*float64))
		assert.EqualValues(t, 2, *frames.Fields[1].At(2).(*float64))
	})

	t.Run("With two filters agg", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
				"timeField": "@timestamp",
				"metrics": [{ "type": "count", "id": "1" }],
	 "bucketAggs": [
					{
						"type": "filters",
						"id": "2",
						"settings": {
							"filters": [{ "query": "@metric:cpu" }, { "query": "@metric:logins.count" }]
						}
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				]
			}`,
		}}
		response := `{
		   "responses": [
			 {
			   "aggregations": {
				 "2": {
				   "buckets": {
					 "@metric:cpu": {
					   "3": {
						 "buckets": [{ "doc_count": 1, "key": 1000 }, { "doc_count": 3, "key": 2000 }]
					   }
					 },
					 "@metric:logins.count": {
					   "3": {
						 "buckets": [{ "doc_count": 2, "key": 1000 }, { "doc_count": 8, "key": 2000 }]
					   }
					 }
				   }
				 }
			   }
			 }
		   ]
				}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		assert.Len(t, queryRes.Frames, 2)

		seriesOne := queryRes.Frames[0]
		require.Len(t, seriesOne.Fields, 2)
		assert.Equal(t, "@metric:cpu", seriesOne.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, seriesOne.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesOne.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesOne.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesOne.Fields[1].Len())
		assert.EqualValues(t, 1, *seriesOne.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 3, *seriesOne.Fields[1].At(1).(*float64))

		seriesTwo := queryRes.Frames[1]
		require.Len(t, seriesTwo.Fields, 2)
		assert.Equal(t, "@metric:logins.count", seriesTwo.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, seriesTwo.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesTwo.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesTwo.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesTwo.Fields[1].Len())
		assert.EqualValues(t, 2, *seriesTwo.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 8, *seriesTwo.Fields[1].At(1).(*float64))
	})

	t.Run("Trim edges trims `trimEdges` amount of data points from the beginning and ending of the time series", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "avg", "id": "1" }, { "type": "count" }],
		 "bucketAggs": [
						{
							"type": "date_histogram",
							"field": "@timestamp",
							"id": "2",
							"settings": { "trimEdges": 2 }
						}
					]
				}`,
		}}
		response := `{
		   "responses": [
			 {
			   "aggregations": {
				 "2": {
				   "buckets": [
					 {
					   "1": { "value": 11 },
					   "key": 1000,
					   "doc_count": 100
					 },
					 {
					   "1": { "value": 22 },
					   "key": 2000,
					   "doc_count": 200
					 },
					 {
					   "1": { "value": 33 },
					   "key": 3000,
					   "doc_count": 300
					 },
					 {
					   "1": { "value": 44 },
					   "key": 4000,
					   "doc_count": 400
					 },
					 {
					   "1": { "value": 55 },
					   "key": 5000,
					   "doc_count": 500
					 },
					 {
					   "1": { "value": 66 },
					   "key": 6000,
					   "doc_count": 600
					 },
					 {
					   "1": { "value": 77 },
					   "key": 7000,
					   "doc_count": 200
					 }
				   ]
				 }
			   }
			 }
		   ]
				}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		assert.Len(t, queryRes.Frames, 2)

		seriesOne := queryRes.Frames[0]
		require.Len(t, seriesOne.Fields, 2)
		assert.Equal(t, "Average", seriesOne.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 3, seriesOne.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 3, 0, time.UTC), *seriesOne.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 4, 0, time.UTC), *seriesOne.Fields[0].At(1).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 5, 0, time.UTC), *seriesOne.Fields[0].At(2).(*time.Time))
		require.Equal(t, 3, seriesOne.Fields[1].Len())
		assert.EqualValues(t, 33, *seriesOne.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 44, *seriesOne.Fields[1].At(1).(*float64))
		assert.EqualValues(t, 55, *seriesOne.Fields[1].At(2).(*float64))

		seriesTwo := queryRes.Frames[1]
		require.Len(t, seriesTwo.Fields, 2)
		assert.Equal(t, "Count", seriesTwo.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 3, seriesTwo.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 3, 0, time.UTC), *seriesTwo.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 4, 0, time.UTC), *seriesTwo.Fields[0].At(1).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 5, 0, time.UTC), *seriesTwo.Fields[0].At(2).(*time.Time))
		require.Equal(t, 3, seriesTwo.Fields[1].Len())
		assert.EqualValues(t, 300, *seriesTwo.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 400, *seriesTwo.Fields[1].At(1).(*float64))
		assert.EqualValues(t, 500, *seriesTwo.Fields[1].At(2).(*float64))
	})

	t.Run("No group by time", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
						"timeField": "@timestamp",
						"metrics": [{ "type": "avg", "id": "1" }, { "type": "count" }],
			 "bucketAggs": [{ "type": "terms", "field": "host", "id": "2" }]
					}`,
		}}
		response := `{
			   "responses": [
				 {
				   "aggregations": {
					 "2": {
					   "buckets": [
						 {
						   "1": { "value": 1000 },
						   "key": "server-1",
						   "doc_count": 369
						 },
						 {
						   "1": { "value": 2000 },
						   "key": "server-2",
						   "doc_count": 200
						 }
					   ]
					 }
				   }
				 }
			   ]
					}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)

		assert.Len(t, queryRes.Frames, 1)

		frames := queryRes.Frames[0]
		require.Len(t, frames.Fields, 3)
		require.Equal(t, 2, frames.Fields[0].Len())
		assert.Equal(t, "host", frames.Fields[0].Name)
		assert.Equal(t, "server-1", *frames.Fields[0].At(0).(*string))
		assert.Equal(t, "server-2", *frames.Fields[0].At(1).(*string))

		require.Equal(t, 2, frames.Fields[1].Len())
		assert.Equal(t, "Average", frames.Fields[1].Name)
		assert.EqualValues(t, 1000, *frames.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 2000, *frames.Fields[1].At(1).(*float64))

		require.Equal(t, 2, frames.Fields[2].Len())
		assert.Equal(t, "Count", frames.Fields[2].Name)
		assert.EqualValues(t, 369, *frames.Fields[2].At(0).(*float64))
		assert.EqualValues(t, 200, *frames.Fields[2].At(1).(*float64))
	})

	t.Run("Multiple metrics of same type", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
							"timeField": "@timestamp",
							"metrics": [{ "type": "avg", "field": "test", "id": "1" }, { "type": "avg", "field": "test2", "id": "2" }],
				 "bucketAggs": [{ "type": "terms", "field": "host", "id": "2" }]
						}`,
		}}
		response := `{
			   "responses": [
				 {
				   "aggregations": {
					 "2": {
					   "buckets": [
						 {
						   "1": { "value": 1000 },
						   "2": { "value": 3000 },
						   "key": "server-1",
						   "doc_count": 369
						 }
					   ]
					 }
				   }
				 }
			   ]
					}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		assert.Len(t, queryRes.Frames, 1)

		frames := queryRes.Frames[0]
		require.Len(t, frames.Fields, 3)
		require.Equal(t, 1, frames.Fields[0].Len())
		assert.Equal(t, "host", frames.Fields[0].Name)
		assert.Equal(t, "server-1", *frames.Fields[0].At(0).(*string))

		require.Equal(t, 1, frames.Fields[1].Len())
		assert.Equal(t, "Average test", frames.Fields[1].Name)
		assert.EqualValues(t, 1000, *frames.Fields[1].At(0).(*float64))

		require.Equal(t, 1, frames.Fields[2].Len())
		assert.Equal(t, "Average test2", frames.Fields[2].Name)
		assert.EqualValues(t, 3000, *frames.Fields[2].At(0).(*float64))
	})

	t.Run("With bucket_script", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					"timeField": "@timestamp",
					"metrics": [
						{ "id": "1", "type": "sum", "field": "@value" },
						{ "id": "3", "type": "max", "field": "@value" },
						{
						 "id": "4",
						 "field": "select field",
						 "pipelineVariables": [{ "name": "var1", "pipelineAgg": "1" }, { "name": "var2", "pipelineAgg": "3" }],
						 "settings": { "script": "params.var1 * params.var2" },
						 "type": "bucket_script"
						}
					],
			 "bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "2" }]
					}`,
		}}
		response := `{
			   "responses": [
				 {
				   "aggregations": {
					 "2": {
					   "buckets": [
						 {
						   "1": { "value": 2 },
						   "3": { "value": 3 },
						   "4": { "value": 6 },
						   "doc_count": 60,
						   "key": 1000
						 },
						 {
						   "1": { "value": 3 },
						   "3": { "value": 4 },
						   "4": { "value": 12 },
						   "doc_count": 60,
						   "key": 2000
						 }
					   ]
					 }
				   }
				 }
			   ]
					}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		require.Len(t, queryRes.Frames, 3)
		seriesOne := queryRes.Frames[0]
		require.Len(t, seriesOne.Fields, 2)
		assert.Equal(t, "Sum @value", seriesOne.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, seriesOne.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesOne.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesOne.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesOne.Fields[1].Len())
		assert.EqualValues(t, 2, *seriesOne.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 3, *seriesOne.Fields[1].At(1).(*float64))

		seriesTwo := queryRes.Frames[1]
		require.Len(t, seriesTwo.Fields, 2)
		assert.Equal(t, "Max @value", seriesTwo.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, seriesTwo.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesTwo.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesTwo.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesTwo.Fields[1].Len())
		assert.EqualValues(t, 3, *seriesTwo.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 4, *seriesTwo.Fields[1].At(1).(*float64))

		seriesThree := queryRes.Frames[2]
		require.Len(t, seriesThree.Fields, 2)
		assert.Equal(t, "Sum @value * Max @value", seriesThree.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 2, seriesThree.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesThree.Fields[0].At(0).(*time.Time))
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesThree.Fields[0].At(1).(*time.Time))
		require.Equal(t, 2, seriesThree.Fields[1].Len())
		assert.EqualValues(t, 6, *seriesThree.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 12, *seriesThree.Fields[1].At(1).(*float64))
	})

	t.Run("Terms with two bucket_script", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					"timeField": "@timestamp",
					"metrics": [
						{ "id": "1", "type": "sum", "field": "@value" },
					{ "id": "3", "type": "max", "field": "@value" },
					{
							"id": "4",
							"field": "select field",
							"pipelineVariables": [{ "name": "var1", "pipelineAgg": "1" }, { "name": "var2", "pipelineAgg": "3" }],
							"settings": { "script": "params.var1 * params.var2" },
							"type": "bucket_script"
						},
					{
							"id": "5",
							"field": "select field",
							"pipelineVariables": [{ "name": "var1", "pipelineAgg": "1" }, { "name": "var2", "pipelineAgg": "3" }],
							"settings": { "script": "params.var1 * params.var2 * 2" },
							"type": "bucket_script"
					  }
					],
		"bucketAggs": [{ "type": "terms", "field": "@timestamp", "id": "2" }]
				}`,
		}}
		response := `{
				"responses": [
					{
						"aggregations": {
						"2": {
							"buckets": [
							{
								"1": { "value": 2 },
								"3": { "value": 3 },
								"4": { "value": 6 },
								"5": { "value": 24 },
								"doc_count": 60,
								"key": 1000
							},
							{
								"1": { "value": 3 },
								"3": { "value": 4 },
								"4": { "value": 12 },
								"5": { "value": 48 },
								"doc_count": 60,
								"key": 2000
							}
							]
						}
						}
					}
				]
			}`
		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)
		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)

		require.Len(t, queryRes.Frames, 1)
		frames := queryRes.Frames[0]
		require.Len(t, frames.Fields, 5)
		require.Equal(t, 2, frames.Fields[0].Len())
		assert.Equal(t, "@timestamp", frames.Fields[0].Name)
		assert.EqualValues(t, 1000, *frames.Fields[0].At(0).(*float64))
		assert.EqualValues(t, 2000, *frames.Fields[0].At(1).(*float64))

		require.Equal(t, 2, frames.Fields[1].Len())
		assert.Equal(t, "Sum", frames.Fields[1].Name)
		assert.EqualValues(t, 2, *frames.Fields[1].At(0).(*float64))
		assert.EqualValues(t, 3, *frames.Fields[1].At(1).(*float64))

		require.Equal(t, 2, frames.Fields[2].Len())
		assert.Equal(t, "Max", frames.Fields[2].Name)
		assert.EqualValues(t, 3, *frames.Fields[2].At(0).(*float64))
		assert.EqualValues(t, 4, *frames.Fields[2].At(1).(*float64))

		require.Equal(t, 2, frames.Fields[3].Len())
		assert.Equal(t, "params.var1 * params.var2", frames.Fields[3].Name)
		assert.EqualValues(t, 6, *frames.Fields[3].At(0).(*float64))
		assert.EqualValues(t, 12, *frames.Fields[3].At(1).(*float64))

		require.Equal(t, 2, frames.Fields[4].Len())
		assert.Equal(t, "params.var1 * params.var2 * 2", frames.Fields[4].Name)
		assert.EqualValues(t, 24, *frames.Fields[4].At(0).(*float64))
		assert.EqualValues(t, 48, *frames.Fields[4].At(1).(*float64))
	})
}

func TestProcessLogsResponse_creates_correct_data_frame_fields(t *testing.T) {
	// creates correct data frame fields
	targets := []tsdbQuery{{
		refId: "A",
		body: `{
					"refId": "A",
					"timeField": "@timestamp",
					"metrics": [{ "type": "logs"}],
			 		"bucketAggs": [
							{
							  "type": "date_histogram",
							  "settings": { "interval": "auto" },
							  "id": "2"
							}
					  ],
					"key": "Q-1561369883389-0.7611823271062786-0",
					"query": "hello AND message"
				}`,
	}}

	response := `
		{
		   "responses":[
			  {
				 "aggregations":{

				 },
				 "hits":{
					"hits":[
					   {
						  "_id":"fdsfs",
						  "_type":"_doc",
						  "_index":"mock-index",
						  "_source":{
							 "testtime":"06/24/2019",
							 "host":"djisaodjsoad",
							 "number":1,
							 "line":"hello, i am a message",
							 "level":"debug",
							 "fields":{
								"lvl":"debug"
							 }
						  },
						  "fields":{
							 "testtime":[
								"2019-06-24T09:51:19.765Z"
							 ]
						  }
					   },
					   {
						  "_id":"kdospaidopa",
						  "_type":"_doc",
						  "_index":"mock-index",
						  "_source":{
							 "testtime":"06/24/2019",
							 "host":"dsalkdakdop",
							 "number":2,
							 "line":"hello, i am also message",
							 "level":"error",
							 "fields":{
								"lvl":"info"
							 }
						  },
						  "fields":{
							 "testtime":[
								"2019-06-24T09:52:19.765Z"
							 ]
						  }
					   }
					]
				 }
			  }
		   ]
		}`

	rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "testtime"}, nil)
	assert.NoError(t, err)
	result, err := rp.parseResponse()
	require.NoError(t, err)

	queryRes := result.Responses["A"]
	require.NotNil(t, queryRes)
	require.Len(t, queryRes.Frames, 1)

	expectedFrame := data.NewFrame("",
		data.NewField("testtime", nil, // gets correct time field from fields
			[]*time.Time{
				utils.Pointer(time.Date(2019, 6, 24, 9, 51, 19, 765000000, time.UTC)),
				utils.Pointer(time.Date(2019, 6, 24, 9, 52, 19, 765000000, time.UTC)),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("_id", nil,
			[]*string{
				utils.Pointer("fdsfs"),
				utils.Pointer("kdospaidopa"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("_index", nil,
			[]*string{
				utils.Pointer("mock-index"),
				utils.Pointer("mock-index"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("_source", nil,
			[]*string{
				utils.Pointer(`{"fields.lvl":"debug","host":"djisaodjsoad","level":"debug","line":"hello, i am a message","number":1,"testtime":"06/24/2019"}`),
				utils.Pointer(`{"fields.lvl":"info","host":"dsalkdakdop","level":"error","line":"hello, i am also message","number":2,"testtime":"06/24/2019"}`),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("_type", nil,
			[]*string{
				utils.Pointer("_doc"),
				utils.Pointer("_doc"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("fields.lvl", nil,
			[]*string{
				utils.Pointer("debug"),
				utils.Pointer("info"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("host", nil,
			[]*string{
				utils.Pointer("djisaodjsoad"),
				utils.Pointer("dsalkdakdop"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("level", nil, // creates correct level field
			[]*string{
				utils.Pointer("debug"),
				utils.Pointer("error"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("line", nil,
			[]*string{
				utils.Pointer("hello, i am a message"),
				utils.Pointer("hello, i am also message"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("number", nil,
			[]*float64{
				utils.Pointer(float64(1)),
				utils.Pointer(float64(2)),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
	).SetMeta(&data.FrameMeta{PreferredVisualization: "logs"})
	if diff := cmp.Diff(expectedFrame, result.Responses["A"].Frames[0], data.FrameTestCompareOptions()...); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}
}

func TestProcessLogsResponse_empty_response(t *testing.T) {
	// Empty response
	targets := []tsdbQuery{{
		refId: "A",
		body: `
			   {
				  "refId":"A",
				  "timeField": "@timestamp",
				  "metrics":[
					 {
						"type":"logs",
						"id":"2"
					 }
				  ],
				  "bucketAggs":[

				  ],
				  "key":"Q-1561369883389-0.7611823271062786-0",
				  "query":"hello AND message"
			   }`,
	}}

	response := `
			{
				"responses": [
				  {
					"hits": { "hits": [] },
					"aggregations": {},
					"status": 200
				  }
				]
			}`

	rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "testtime"}, nil)
	assert.NoError(t, err)
	result, err := rp.parseResponse()
	require.NoError(t, err)

	queryRes := result.Responses["A"]
	require.NotNil(t, queryRes)
	require.Len(t, queryRes.Frames, 1)

	expectedFrame := data.NewFrame("").SetMeta(&data.FrameMeta{PreferredVisualization: "logs"})
	data.FrameTestCompareOptions()
	if diff := cmp.Diff(expectedFrame, result.Responses["A"].Frames[0], data.FrameTestCompareOptions()...); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}
}

func TestProcessLogsResponse_log_query_with_nested_fields(t *testing.T) {
	// Log query with nested fields
	targets := []tsdbQuery{{
		refId: "A",
		body:  `{"timeField": "@timestamp", "metrics": [{ "type": "logs" }]}`,
	}}

	response := `
			{
			   "responses":[
				  {
					 "hits":{
						"total":{
						   "value":109,
						   "relation":"eq"
						},
						"max_score":null,
						"hits":[
						   {
							  "_index":"logs-2023.02.08",
							  "_id":"GB2UMYYBfCQ-FCMjayJa",
							  "_score":null,
							  "_source":{
								 "@timestamp":"2023-02-08T15:10:55.830Z",
								 "line":"log text  [479231733]",
								 "counter":"109",
								 "float":58.253758485091,
								 "label":"val1",
								 "lvl":"info",
								 "location":"17.089705232090438, 41.62861966340297",
								 "nested":{
									"field":{
									   "double_nested":true
									}
								 },
								 "shapes":[
									{
									   "type":"triangle"
									},
									{
									   "type":"square"
									}
								 ],
								 "xyz":null
							  },
							  "sort":[
								 1675869055830,
								 4
							  ]
						   },
						   {
							  "_index":"logs-2023.02.08",
							  "_id":"Fx2UMYYBfCQ-FCMjZyJ_",
							  "_score":null,
							  "_source":{
								 "@timestamp":"2023-02-08T15:10:54.835Z",
								 "line":"log text with ANSI \u001b[31mpart of the text\u001b[0m [493139080]",
								 "counter":"108",
								 "float":54.5977098233944,
								 "label":"val1",
								 "lvl":"info",
								 "location":"19.766305918490463, 40.42639175509792",
								 "nested":{
									"field":{
									   "double_nested":false
									}
								 },
								 "shapes":[
									{
									   "type":"triangle"
									},
									{
									   "type":"square"
									}
								 ],
								 "xyz":"def"
							  },
							  "sort":[
								 1675869054835,
								 7
							  ]
						   }
						]
					 },
					 "status":200
				  }
			   ]
			}`

	rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp", LogMessageField: "line", LogLevelField: "lvl"}, nil)
	assert.NoError(t, err)
	result, err := rp.parseResponse()
	require.NoError(t, err)

	queryRes := result.Responses["A"]
	require.NotNil(t, queryRes)
	require.Len(t, queryRes.Frames, 1)

	expectedFrame := data.NewFrame("",
		data.NewField("@timestamp", nil, // First field is timeField
			[]*time.Time{
				utils.Pointer(time.Date(2023, 2, 8, 15, 10, 55, 830000000, time.UTC)),
				utils.Pointer(time.Date(2023, 2, 8, 15, 10, 54, 835000000, time.UTC)),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("line", nil, // Second is log line
			[]*string{
				utils.Pointer("log text  [479231733]"),
				utils.Pointer("log text with ANSI \x1b[31mpart of the text\x1b[0m [493139080]"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("_id", nil,
			[]*string{ // Correctly uses string types
				utils.Pointer("GB2UMYYBfCQ-FCMjayJa"),
				utils.Pointer("Fx2UMYYBfCQ-FCMjZyJ_"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("_index", nil,
			[]*string{
				utils.Pointer("logs-2023.02.08"),
				utils.Pointer("logs-2023.02.08"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("_source", nil,
			[]*string{
				utils.Pointer(`{"@timestamp":"2023-02-08T15:10:55.830Z","counter":"109","float":58.253758485091,"label":"val1","line":"log text  [479231733]","location":"17.089705232090438, 41.62861966340297","lvl":"info","nested.field.double_nested":true,"shapes":[{"type":"triangle"},{"type":"square"}],"xyz":null}`),
				utils.Pointer(`{"@timestamp":"2023-02-08T15:10:54.835Z","counter":"108","float":54.5977098233944,"label":"val1","line":"log text with ANSI \u001b[31mpart of the text\u001b[0m [493139080]","location":"19.766305918490463, 40.42639175509792","lvl":"info","nested.field.double_nested":false,"shapes":[{"type":"triangle"},{"type":"square"}],"xyz":"def"}`),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("_type", nil,
			[]*json.RawMessage{
				utils.Pointer(json.RawMessage(`null`)),
				utils.Pointer(json.RawMessage(`null`)),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("counter", nil,
			[]*string{
				utils.Pointer("109"),
				utils.Pointer("108"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("float", nil,
			[]*float64{ // Correctly detects float64 types
				utils.Pointer(58.253758485091),
				utils.Pointer(54.5977098233944),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("label", nil,
			[]*string{
				utils.Pointer("val1"),
				utils.Pointer("val1"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("level", nil, // lvl field correctly renamed to level
			[]*string{
				utils.Pointer("info"),
				utils.Pointer("info"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("location", nil,
			[]*string{
				utils.Pointer("17.089705232090438, 41.62861966340297"),
				utils.Pointer("19.766305918490463, 40.42639175509792"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("nested.field.double_nested", nil, // Correctly flattens fields
			[]*bool{
				utils.Pointer(true),
				utils.Pointer(false),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("shapes", nil,
			[]*json.RawMessage{ // Correctly detects json types
				utils.Pointer(json.RawMessage(`[{"type":"triangle"},{"type":"square"}]`)),
				utils.Pointer(json.RawMessage(`[{"type":"triangle"},{"type":"square"}]`)),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
		data.NewField("xyz", nil,
			[]*string{
				nil, // Correctly detects type even if first value is null
				utils.Pointer("def"),
			}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(true)}),
	).SetMeta(&data.FrameMeta{PreferredVisualization: "logs", Custom: map[string]interface{}{"total": 109}})
	if diff := cmp.Diff(expectedFrame, result.Responses["A"].Frames[0], data.FrameTestCompareOptions()...); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}
}

func Test_getTimestamp(t *testing.T) {
	/*
		First look for time in fields:
		   "hits": [
		     {
		       "fields": {
		         "timestamp": [
		           "2022-12-30T15:42:54.000Z"
		         ]
		       }
		     }
		   ]

		If not present, look for time in _source:
		"hits": [
		  {
			"_source": {
			  "timestamp": "2022-12-30T15:42:54.000Z"
			}
		  }
		]
	*/
	t.Run("When fields is present with array of times and source's time field is also present, then getTimestamp prefers fields", func(t *testing.T) {
		hit := map[string]interface{}{
			"fields": map[string]interface{}{"@timestamp": []interface{}{"2018-08-18T08:08:08.765Z"}},
		}

		actual, ok := getTimestamp(hit, "@timestamp")

		require.NotNil(t, actual)
		assert.True(t, ok)
		assert.Equal(t, time.Date(2018, time.August, 18, 8, 8, 8, 765000000, time.UTC), actual)
	})

	t.Run("When fields is absent and source's time field is present, then getTimestamp falls back to _source", func(t *testing.T) {
		hit := map[string]interface{}{
			"_source": map[string]interface{}{"@timestamp": "2020-01-01T10:10:10.765Z"},
		}

		actual, ok := getTimestamp(hit, "@timestamp")

		assert.True(t, ok)
		assert.Equal(t, time.Date(2020, time.January, 01, 10, 10, 10, 765000000, time.UTC), actual)
	})

	t.Run("When fields has its timestamp in an unexpected layout and _source's time field is also present, then getTimestamp falls back to _source", func(t *testing.T) {
		hit := map[string]interface{}{
			"fields":  map[string]interface{}{"@timestamp": "2018-08-18T08:08:08.765Z"},
			"_source": map[string]interface{}{"@timestamp": "2020-01-01T10:10:10.765Z"},
		}

		actual, ok := getTimestamp(hit, "@timestamp")

		assert.True(t, ok)
		assert.Equal(t, time.Date(2020, time.January, 01, 10, 10, 10, 765000000, time.UTC), actual)
	})

	t.Run("When fields's timestamp has an unexpected format, then getTimestamp looks in source", func(t *testing.T) {
		hit := map[string]interface{}{
			"fields":  map[string]interface{}{"@timestamp": []interface{}{"unexpected format"}},
			"_source": map[string]interface{}{"@timestamp": "2020-01-01T10:10:10.765Z"},
		}

		actual, ok := getTimestamp(hit, "@timestamp")

		assert.True(t, ok)
		assert.Equal(t, time.Date(2020, time.January, 01, 10, 10, 10, 765000000, time.UTC), actual)
	})

	t.Run("When fields is absent and _source's time field has an unexpected format, then getTimestamp returns false", func(t *testing.T) {
		hit := map[string]interface{}{
			"_source": map[string]interface{}{"@timestamp": "unexpected format"},
		}

		_, ok := getTimestamp(hit, "@timestamp")

		assert.False(t, ok)
	})

	t.Run("When fields is absent and _source's time field is absent, then getTimestamp returns false", func(t *testing.T) {
		_, ok := getTimestamp(nil, "@timestamp")

		assert.False(t, ok)
	})
}

func Test_ProcessRawDataResponse(t *testing.T) {
	t.Run("ProcessRawDataResponse populates standard fields and gets other fields from _source, in alphabetical order, with time at the beginning", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					  "timeField": "@timestamp",
					  "metrics": [{"type": "raw_data"}]
				}`,
		}}
		response := `{
			  "responses": [
				{
				  "hits": {
					"total": {
					  "value": 109,
					  "relation": "eq"
					},
					"max_score": null,
					"hits": [
					  {
						"_index": "logs-2023.02.08",
						"_id": "some id",
						"_score": null,
						"_source": {
							"some other field": 15
						},
						"fields": {
						  "@timestamp": [
							"2022-12-30T15:42:54.000Z"
						  ]
						},
						"sort": [
						  1675869055830,
						  4
						]
					  }
					]
				  },
				  "status": 200
				}
			  ]
			}`

		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		require.NoError(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		require.NotNil(t, queryRes)
		dataframes := queryRes.Frames
		require.Len(t, dataframes, 1)

		frame := dataframes[0]

		assert.Equal(t, 5, len(frame.Fields))
		require.Equal(t, 1, frame.Fields[0].Len())
		assert.Equal(t, time.Date(2022, time.December, 30, 15, 42, 54, 0, time.UTC), *frame.Fields[0].At(0).(*time.Time))
		require.Equal(t, 1, frame.Fields[1].Len())
		assert.Equal(t, "_id", frame.Fields[1].Name)
		assert.Equal(t, "some id", *frame.Fields[1].At(0).(*string))
		require.Equal(t, 1, frame.Fields[2].Len())
		assert.Equal(t, "_index", frame.Fields[2].Name)
		assert.Equal(t, "logs-2023.02.08", *frame.Fields[2].At(0).(*string))
		require.Equal(t, 1, frame.Fields[3].Len())
		assert.Equal(t, "_type", frame.Fields[3].Name)
		assert.Equal(t, json.RawMessage("null"), *frame.Fields[3].At(0).(*json.RawMessage))
		require.Equal(t, 1, frame.Fields[4].Len())
		assert.Equal(t, "some other field", frame.Fields[4].Name)
		assert.Equal(t, float64(15), *frame.Fields[4].At(0).(*float64))
	})

	t.Run("no time in _source or in fields does not create data frame field at the beginning with a nil time", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					  "timeField": "@timestamp",
					  "metrics": [{"type": "raw_data"}]
				}`,
		}}

		response := `{
			  "responses": [
				{
				  "hits": {
					"hits": [
					  {
						"_index": "logs-2023.02.08",
						"_id": "some id",
						"_score": null,
						"_source": {},
						"sort": [
						  1675869055830,
						  4
						]
					  }
					]
				  }
				}
			  ]
			}`

		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		require.NoError(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		require.NotNil(t, queryRes)
		dataframes := queryRes.Frames
		require.Len(t, dataframes, 1)

		frame := dataframes[0]
		require.Equal(t, 3, len(frame.Fields))
		assert.Equal(t, "_id", frame.Fields[0].Name)
		assert.Equal(t, "_index", frame.Fields[1].Name)
		assert.Equal(t, "_type", frame.Fields[2].Name)
	})

	t.Run("Simple raw data query", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					  "timeField": "@timestamp",
					  "metrics": [{"type": "raw_data"}]
				}`,
		}}

		response := `{
			   "responses":[
				  {
					 "hits":{
						"total":{
						   "value":109,
						   "relation":"eq"
						},
						"max_score":null,
						"hits":[
						   {
							  "_index":"logs-2023.02.08",
							  "_id":"some id",
							  "_score":null,
							  "_source":{
								 "@timestamp":"2023-02-08T15:10:55.830Z",
								 "line":"log text  [479231733]",
								 "counter":"109",
								 "float":58.253758485091,
								 "label":"val1",
								 "level":"info",
								 "location":"17.089705232090438, 41.62861966340297",
								 "nested":{
									"field":{
									   "double_nested":"value"
									}
								 },
								 "shapes":[
									{
									   "type":"triangle"
									},
									{
									   "type":"square"
									}
								 ],
								 "xyz":null
							  },
							  "fields": {
								  "@timestamp": [
									"2023-02-08T15:10:55.830Z"
								  ]
								},
							  "sort":[
								 1675869055830,
								 4
							  ]
						   },
						   {
							  "_index":"logs-2023.02.08",
							  "_id":"Fx2UMYYBfCQ-FCMjZyJ_",
							  "_score":null,
							  "_source":{
								 "@timestamp":"2023-02-08T15:10:54.835Z",
								 "line":"log text with ANSI \u001b[31mpart of the text\u001b[0m [493139080]",
								 "counter":"108",
								 "float":54.5977098233944,
								 "label":"val1",
								 "level":"info",
								 "location":"19.766305918490463, 40.42639175509792",
								 "nested":{
									"field":{
									   "double_nested":"value"
									}
								 },
								 "shapes":[
									{
									   "type":"triangle"
									},
									{
									   "type":"square"
									}
								 ],
								 "xyz":"def"
							  },
							  "fields": {
								  "@timestamp": [
									"2023-02-08T15:10:54.835Z"
								  ]
								},
							  "sort":[
								 1675869054835,
								 7
							  ]
						   }
						]
					 },
					 "status":200
				  }
			   ]
			}`

		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		require.NoError(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		require.NotNil(t, queryRes)
		dataframes := queryRes.Frames
		require.Len(t, dataframes, 1)
		frame := dataframes[0]

		assert.Equal(t, 13, len(frame.Fields))
		// Fields have the correct length
		assert.Equal(t, 2, frame.Fields[0].Len())
		// First field is timeField
		assert.Equal(t, data.FieldTypeNullableTime, frame.Fields[0].Type())
		// Correctly uses string types
		assert.Equal(t, data.FieldTypeNullableString, frame.Fields[1].Type())
		// Correctly detects float64 types
		assert.Equal(t, data.FieldTypeNullableFloat64, frame.Fields[5].Type())
		// Correctly detects json types
		assert.Equal(t, data.FieldTypeNullableJSON, frame.Fields[11].Type())
		assert.Equal(t, "nested.field.double_nested", frame.Fields[10].Name)
		assert.Equal(t, data.FieldTypeNullableString, frame.Fields[10].Type())
		// Correctly detects type even if first value is null
		assert.Equal(t, data.FieldTypeNullableString, frame.Fields[12].Type())
	})

	t.Run("Raw data query filterable fields", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					  "timeField": "@timestamp",
					  "metrics": [{ "type": "raw_data", "id": "1" }],
				      "bucketAggs": []
				}`,
		}}

		response := `
					{
						"responses": [
						  {
							"hits": {
							  "total": { "relation": "eq", "value": 1 },
							  "hits": [
								{
								  "_id": "1",
								  "_type": "_doc",
								  "_index": "index",
								  "_source": { "sourceProp": "asd" },
								  "fields": {
									  "@timestamp": [
										"2023-02-08T15:10:54.835Z"
									  ]
							    	}
								}
							  ]
							}
						  }
						]
					}
				`

		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		require.NoError(t, err)

		require.NotNil(t, result.Responses["A"])
		require.Len(t, result.Responses["A"].Frames, 1)

		for _, field := range result.Responses["A"].Frames[0].Fields {
			trueValue := true
			filterableConfig := data.FieldConfig{Filterable: &trueValue}

			// we need to test that the only changed setting is `filterable`
			require.Equal(t, filterableConfig, *field.Config)
		}
	})
}

func TestHistogramSimple(t *testing.T) {
	query := []tsdbQuery{{
		refId: "A",
		body: `{
				"timeField": "@timestamp",
				"metrics": [{ "type": "count", "id": "1" }],
				"bucketAggs": [{ "type": "histogram", "field": "bytes", "id": "3" }]
			}`,
	}}
	response := `
		{
			"responses": [
			  {
				"aggregations": {
				  "3": {
					"buckets": [
					  { "doc_count": 1, "key": 1000 },
					  { "doc_count": 3, "key": 2000 },
					  { "doc_count": 2, "key": 1000 }
					]
				  }
				}
			  }
			]
		}`
	rp, err := newResponseParserForTest(query, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
	assert.NoError(t, err)
	result, err := rp.parseResponse()
	assert.NoError(t, err)
	require.Len(t, result.Responses, 1)

	queryRes := result.Responses["A"]
	assert.NotNil(t, queryRes)
	assert.Len(t, queryRes.Frames, 1)

	rowLength, err := queryRes.Frames[0].RowLen()
	require.NoError(t, err)
	require.Equal(t, 3, rowLength)

	frames := queryRes.Frames[0]
	require.Len(t, frames.Fields, 2)
	require.Equal(t, 3, frames.Fields[0].Len())
	assert.Equal(t, "bytes", frames.Fields[0].Name)
	assert.EqualValues(t, 1000, *frames.Fields[0].At(0).(*float64))
	assert.EqualValues(t, 2000, *frames.Fields[0].At(1).(*float64))
	assert.EqualValues(t, 1000, *frames.Fields[0].At(2).(*float64))
	trueValue := true
	filterableConfig := data.FieldConfig{Filterable: &trueValue}
	// we need to test that the only changed setting is `filterable`
	require.NotNil(t, frames.Fields[0].Config)
	assert.Equal(t, filterableConfig, *frames.Fields[0].Config)

	require.Equal(t, 3, frames.Fields[1].Len())
	assert.Equal(t, "Count", frames.Fields[1].Name)
	assert.EqualValues(t, 1, *frames.Fields[1].At(0).(*float64))
	assert.EqualValues(t, 3, *frames.Fields[1].At(1).(*float64))
	assert.EqualValues(t, 2, *frames.Fields[1].At(2).(*float64))
	// we need to test that the fieldConfig is "empty"
	assert.Nil(t, frames.Fields[1].Config)
}

func Test_flatten(t *testing.T) {
	t.Run("does not affect any non-nested JSON", func(t *testing.T) {
		target := map[string]interface{}{
			"fieldName": "",
		}

		assert.Equal(t, map[string]interface{}{
			"fieldName": "",
		}, flatten(target, 10))
	})

	t.Run("flattens up to maxDepth", func(t *testing.T) {
		target := map[string]interface{}{
			"fieldName2": map[string]interface{}{
				"innerFieldName2": map[string]interface{}{
					"innerFieldName3": "",
				},
			},
		}

		assert.Equal(t, map[string]interface{}{
			"fieldName2.innerFieldName2": map[string]interface{}{"innerFieldName3": ""}}, flatten(target, 1))
	})

	t.Run("flattens up to maxDepth with multiple keys in target", func(t *testing.T) {
		target := map[string]interface{}{
			"fieldName": map[string]interface{}{
				"innerFieldName": "",
			},
			"fieldName2": map[string]interface{}{
				"innerFieldName2": map[string]interface{}{
					"innerFieldName3": "",
				},
			},
		}

		assert.Equal(t, map[string]interface{}{"fieldName.innerFieldName": "", "fieldName2.innerFieldName2": map[string]interface{}{"innerFieldName3": ""}}, flatten(target, 1))
	})

	t.Run("flattens multiple objects of the same max depth", func(t *testing.T) {
		target := map[string]interface{}{
			"fieldName": map[string]interface{}{
				"innerFieldName": "",
			},
			"fieldName2": map[string]interface{}{
				"innerFieldName2": "",
			},
		}

		assert.Equal(t, map[string]interface{}{
			"fieldName.innerFieldName":   "",
			"fieldName2.innerFieldName2": ""}, flatten(target, 1))
	})

	t.Run("only flattens multiple entries in the same key", func(t *testing.T) {
		target := map[string]interface{}{
			"fieldName": map[string]interface{}{
				"innerFieldName":  "",
				"innerFieldName1": "",
			},
			"fieldName2": map[string]interface{}{
				"innerFieldName2": map[string]interface{}{
					"innerFieldName3": "",
				},
			},
		}

		assert.Equal(t, map[string]interface{}{
			"fieldName.innerFieldName":   "",
			"fieldName.innerFieldName1":  "",
			"fieldName2.innerFieldName2": map[string]interface{}{"innerFieldName3": ""}}, flatten(target, 1))
	})

	t.Run("combines nested field names", func(t *testing.T) {
		target := map[string]interface{}{
			"fieldName": map[string]interface{}{
				"innerFieldName": "",
			},
			"fieldName2": map[string]interface{}{
				"innerFieldName2": "",
			},
		}

		assert.Equal(t, map[string]interface{}{"fieldName.innerFieldName": "", "fieldName2.innerFieldName2": ""}, flatten(target, 10))
	})

	t.Run("will preserve only one key with the same name", func(t *testing.T) {
		// This test documents that in the unlikely case of a collision of a flattened name and an existing key, only
		// one entry's value will be preserved at random
		target := map[string]interface{}{
			"fieldName": map[string]interface{}{
				"innerFieldName": "one of these values will be lost",
			},
			"fieldName.innerFieldName": "this may be lost",
		}

		result := flatten(target, 10)
		assert.Len(t, result, 1)
		_, ok := result["fieldName.innerFieldName"]
		assert.True(t, ok)
	})
}

func TestProcessRawDocumentResponse(t *testing.T) {
	t.Run("Simple raw document query", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					"timeField": "@timestamp",
					"refId": "A",
					"metrics": [{ "type": "raw_document", "id": "1" }],
					"bucketAggs": []
					}`,
		}}

		response := `
		{
			"responses": [
				{
				"hits": {
					"total": {"value": 100, "relation": "eq"},
					"hits": [
					{
						"_id": "1",
						"_type": "type",
						"_index": "index",
						"_source": { "sourceProp": "asd" },
						"fields": { "fieldProp": "field" }
					},
					{
						"_source": { "sourceProp": "asd2" },
						"fields": { "fieldProp": "field2" }
					}
					]
				}
				}
			]
		}`

		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		require.NoError(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		require.NotNil(t, queryRes)
		dataframes := queryRes.Frames
		require.Len(t, dataframes, 1)
		require.Len(t, dataframes[0].Fields, 1)
		require.Equal(t, data.FieldTypeNullableJSON, dataframes[0].Fields[0].Type())
		require.Equal(t, 2, dataframes[0].Fields[0].Len())

		doc1 := dataframes[0].Fields[0].At(0).(*json.RawMessage)
		assert.JSONEq(t, `{"_id":"1","_index":"index","_type":"type","fieldProp":"field","sourceProp":"asd"}`, string(*doc1))
		doc2 := dataframes[0].Fields[0].At(1).(*json.RawMessage)
		assert.JSONEq(t, `{"_id":null,"_index":null,"_type":null,"fieldProp":"field2","sourceProp":"asd2"}`, string(*doc2))
	})

	t.Run("More complex raw document query", func(t *testing.T) {
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
						"timeField": "@timestamp",
						"metrics": [{ "type": "raw_document" }]
					}`,
		}}

		response := `{
			   "responses":[
				  {
					 "hits":{
						"total":{
						   "value":109,
						   "relation":"eq"
						},
						"max_score":null,
						"hits":[
						   {
							  "_index":"logs-2023.02.08",
							  "_id":"GB2UMYYBfCQ-FCMjayJa",
							  "_score":null,
							  "fields":{
								 "test_field":"A",
								 "@timestamp":[
									"2023-02-08T15:10:55.830Z"
								 ]
							  },
							  "_source":{
								 "line":"log text  [479231733]",
								 "counter":"109",
								 "float":58.253758485091,
								 "label":"val1",
								 "level":"info",
								 "location":"17.089705232090438, 41.62861966340297",
								 "nested":{
									"field":{
									   "double_nested":"value"
									}
								 }
							  }
						   },
						   {
							  "_index":"logs-2023.02.08",
							  "_id":"Fx2UMYYBfCQ-FCMjZyJ_",
							  "_score":null,
							  "fields":{
								 "test_field":"A"
							  },
							  "_source":{
								 "@timestamp":"2023-02-08T15:10:54.835Z",
								 "line":"log text with ANSI \u001b[31mpart of the text\u001b[0m [493139080]",
								 "counter":"108",
								 "float":54.5977098233944,
								 "label":"val1",
								 "level":"info",
								 "location":"19.766305918490463, 40.42639175509792",
								 "nested":{
									"field":{
									   "double_nested":"value1"
									}
								 }
							  }
						   }
						]
					 },
					 "status":200
				  }
			   ]
			}`

		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		require.NoError(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		require.NotNil(t, queryRes)
		dataframes := queryRes.Frames
		require.Len(t, dataframes, 1)
		require.Len(t, dataframes[0].Fields, 1)
		require.Equal(t, data.FieldTypeNullableJSON, dataframes[0].Fields[0].Type())
		require.Equal(t, 2, dataframes[0].Fields[0].Len())

		doc1 := dataframes[0].Fields[0].At(0).(*json.RawMessage)
		assert.JSONEq(t, `{
			   "@timestamp":["2023-02-08T15:10:55.830Z"],
			   "_id":"GB2UMYYBfCQ-FCMjayJa",
			   "_index":"logs-2023.02.08",
			   "_type":null,
			   "counter":"109",
			   "float":58.253758485091,
			   "label":"val1",
			   "level":"info",
			   "line":"log text  [479231733]",
			   "location":"17.089705232090438, 41.62861966340297",
			   "nested":{
				  "field":{
					 "double_nested":"value"
				  }
			   },
			   "test_field":"A"
			}`, string(*doc1))
		doc2 := dataframes[0].Fields[0].At(1).(*json.RawMessage)
		assert.JSONEq(t, `{
			   "@timestamp":"2023-02-08T15:10:54.835Z",
			   "_id":"Fx2UMYYBfCQ-FCMjZyJ_",
			   "_index":"logs-2023.02.08",
			   "_type":null,
			   "counter":"108",
			   "float":54.5977098233944,
			   "label":"val1",
			   "level":"info",
			   "line":"log text with ANSI \u001b[31mpart of the text\u001b[0m [493139080]",
			   "location":"19.766305918490463, 40.42639175509792",
			   "nested":{
				  "field":{
					 "double_nested":"value1"
				  }
			   },
			   "test_field":"A"
			}`, string(*doc2))
	})

	t.Run("doc returns timeField preferentially from fields", func(t *testing.T) {
		// documents that the timefield is taken from `fields` preferentially because we want to ensure it is the format requested in AddTimeFieldWithStandardizedFormat
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "raw_document", "id": "1" }]
					}`,
		}}

		response := `
				{
			   "responses":[
				  {
					 "hits":{
						"hits":[
						   {
							  "_source":{
								 "@timestamp":"1999-01-01T12:12:12.111Z"
							  },
							  "fields":{
								 "@timestamp":[
									"2023-02-08T15:10:55.830Z"
								 ]
							  }
						   }
						]
					 }
				  }
			   ]
			}`

		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		require.NoError(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		require.NotNil(t, queryRes)
		dataframes := queryRes.Frames
		require.Len(t, dataframes, 1)
		require.Len(t, dataframes[0].Fields, 1)
		require.Equal(t, data.FieldTypeNullableJSON, dataframes[0].Fields[0].Type())
		require.Equal(t, 1, dataframes[0].Fields[0].Len())

		doc1 := dataframes[0].Fields[0].At(0).(*json.RawMessage)
		assert.JSONEq(t, `{"_id":null,"_index":null,"_type":null,"@timestamp":["2023-02-08T15:10:55.830Z"]}`, string(*doc1))
	})

	t.Run("doc returns timeField from _source if fields does not have timeField", func(t *testing.T) {
		// documents that timeField that in _source will be returned
		targets := []tsdbQuery{{
			refId: "A",
			body: `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "raw_document", "id": "1" }]
					}`,
		}}

		response := `
				{
			   "responses":[
				  {
					 "hits":{
						"hits":[
						   {
							  "_source":{
								 "@timestamp":"1999-01-01T12:12:12.111Z"
							  }
						   }
						]
					 }
				  }
			   ]
			}`

		rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, nil)
		assert.Nil(t, err)
		result, err := rp.parseResponse()
		require.NoError(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		require.NotNil(t, queryRes)
		dataframes := queryRes.Frames
		require.Len(t, dataframes, 1)
		require.Len(t, dataframes[0].Fields, 1)
		require.Equal(t, data.FieldTypeNullableJSON, dataframes[0].Fields[0].Type())
		require.Equal(t, 1, dataframes[0].Fields[0].Len())

		doc1 := dataframes[0].Fields[0].At(0).(*json.RawMessage)
		assert.JSONEq(t, `{"_id":null,"_index":null,"_type":null,"@timestamp":"1999-01-01T12:12:12.111Z"}`, string(*doc1))
	})
}

func Test_sortPropNames(t *testing.T) {
	t.Run("returns slice after finding fields in prop names and placing them in front", func(t *testing.T) {
		actual := sortPropNames(
			map[string]bool{"_another_field": true, "lookForThisField": true},
			[]string{"lookForThisField"},
		)
		assert.Equal(t, []string{"lookForThisField", "_another_field"}, actual)
	})

	t.Run("returns slice with anything other than fieldsToGoInFront sorted alphabetically", func(t *testing.T) {
		actual := sortPropNames(
			map[string]bool{"message": true, "_id": true, "lvl": true, "Average": true, "average": true, "timestamp": true, "fluffy": true},
			[]string{"timestamp", "message", "lvl"},
		)
		assert.Equal(t, []string{"timestamp", "message", "lvl", "Average", "_id", "average", "fluffy"}, actual)
	})

	t.Run("does not put an empty configured field in front", func(t *testing.T) {
		t.Run("empty timestamp", func(t *testing.T) {
			actual := sortPropNames(
				map[string]bool{"message": true, "": true, "_id": true, "lvl": true, "timestamp": true},
				[]string{"", "message", "lvl"},
			)
			assert.Equal(t, []string{"message", "lvl", "", "_id", "timestamp"}, actual)
		})

		t.Run("empty message", func(t *testing.T) {
			actual := sortPropNames(
				map[string]bool{"message": true, "": true, "_id": true, "lvl": true, "timestamp": true},
				[]string{"timestamp", "", "lvl"},
			)
			assert.Equal(t, []string{"timestamp", "lvl", "", "_id", "message"}, actual)
		})

		t.Run("empty log level", func(t *testing.T) {
			actual := sortPropNames(
				map[string]bool{"message": true, "": true, "_id": true, "lvl": true, "timestamp": true},
				[]string{"timestamp", "message", ""},
			)
			assert.Equal(t, []string{"timestamp", "message", "", "_id", "lvl"}, actual)
		})
	})
}

func TestProcessTraceSpans_creates_correct_data_frame_fields(t *testing.T) {
	// creates correct data frame fields
	targets := []tsdbQuery{{
		refId: "A",
		body: `{
				"refId": "A",
				"datasource": { "type": "grafana-opensearch-datasource", "uid": "aca30e11-e305-46d1-b378-9b29b690bacb" },
				"query": "traceId:test",
				"queryType": "lucene",
				"alias": "",
				"timeField": "@timestamp",
				"luceneQueryType": "Traces",
				"datasourceId": 13510,
				"intervalMs": 20000,
				"maxDataPoints": 1150
			  }`,
	}}

	response := `
	{
		"responses":[
		   {
			  "aggregations":{
				 
			  },
			  "hits":{
				 "hits":[
					{
					   "_index":"otel-v1-apm-span-000011",
					   "_id":"1205b402698acc85",
					   "_score":3.4040546,
					   "_source":{
						  "traceId":"000000000000000047ed3a25a7dba0cd",
						  "droppedLinksCount":0,
						  "kind":"SPAN_KIND_SERVER",
						  "droppedEventsCount":0,
						  "traceGroupFields":{
							 "endTime":"2023-10-18T07:58:38.689468Z",
							 "durationInNanos":870879000,
							 "statusCode":0
						  },
						  "traceGroup":"HTTP GET /dispatch",
						  "serviceName":"route",
						  "parentSpanId":"3322922831abfec9",
						  "spanId":"1205b402698acc85",
						  "traceState":"",
						  "name":"HTTP GET /route",
						  "startTime":"2023-10-18T07:58:38.534437Z",
						  "links":[
							 
						  ],
						  "endTime":"2023-10-18T07:58:38.581496Z",
						  "droppedAttributesCount":0,
						  "durationInNanos":47059000,
						  "events":[
							 {
								"name":"HTTP request received",
								"time":"2023-10-18T07:58:38.534457Z",
								"attributes":{
								   "method":"GET",
								   "level":"info",
								   "url":"/route?dropoff=577%2C322u0026pickup=541%2C197"
								},
								"droppedAttributesCount":0
							 },
							 {
								"name":"redis timeout",
								"time":"2023-10-18T07:58:38.486123Z",
								"attributes":{
								   "driver_id":"T770179C",
								   "level":"error",
								   "error":"redis timeout"
								},
								"droppedAttributesCount":0
							 }
						  ],
						  "resource.attributes.client-uuid":"3b9fd6a628d36d6e",
						  "resource.attributes.ip":"172.24.0.5",
						  "resource.attributes.host@name":"fc3cfe411fa7",
						  "resource.attributes.opencensus@exporterversion":"Jaeger-Go-2.30.0",
						  "resource.attributes.service@name":"route",
						  "span.attributes.component":"net/http",
						  "span.attributes.http@status_code":200,
						  "status.code":0
					   }
					}
				 ]
			  }
		   }
		]
	 }`

	rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "testtime"}, nil)
	assert.NoError(t, err)
	result, err := rp.parseResponse()
	require.NoError(t, err)

	queryRes := result.Responses["A"]
	assert.NotNil(t, queryRes)
	assert.Len(t, queryRes.Frames, 1)
	series := queryRes.Frames[0]

	require.Equal(t, 1, series.Fields[0].Len())

	stackTracesField := data.NewField("stackTraces", nil,
		[]*json.RawMessage{
			utils.Pointer(json.RawMessage(`["redis timeout: redis timeout"]`)),
		},
	).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(false)})

	if diff := cmp.Diff(stackTracesField, series.Fields[17], data.FrameTestCompareOptions()...); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}

	startTimeFields := data.NewField("startTime", nil,
		[]*int64{
			utils.Pointer(int64(1697615918534)),
		}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(false)})

	if diff := cmp.Diff(startTimeFields, series.Fields[18], data.FrameTestCompareOptions()...); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}

	traceIdFields := data.NewField("traceID", nil,
		[]*string{
			utils.Pointer("000000000000000047ed3a25a7dba0cd"),
		}).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(false)})

	if diff := cmp.Diff(traceIdFields, series.Fields[23], data.FrameTestCompareOptions()...); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}

	durationFields := data.NewField("duration", nil,
		[]*float64{
			utils.Pointer(47.059),
		},
	).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(false)})
	if diff := cmp.Diff(durationFields, series.Fields[7], data.FrameTestCompareOptions()...); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}

	parentSpanIdFields := data.NewField("parentSpanID", nil,
		[]*string{
			utils.Pointer("3322922831abfec9"),
		},
	).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(false)})
	if diff := cmp.Diff(parentSpanIdFields, series.Fields[13], data.FrameTestCompareOptions()...); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}

	spanIDFields := data.NewField("spanID", nil,
		[]*string{
			utils.Pointer("1205b402698acc85"),
		},
	).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(false)})
	if diff := cmp.Diff(spanIDFields, series.Fields[16], data.FrameTestCompareOptions()...); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}

	operationNameFields := data.NewField("operationName", nil,
		[]*string{
			utils.Pointer("HTTP GET /route"),
		},
	).SetConfig(&data.FieldConfig{Filterable: utils.Pointer(false)})

	if diff := cmp.Diff(operationNameFields, series.Fields[12], data.FrameTestCompareOptions()...); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}

	// serviceTags
	sortedServiceTags := sortObjectsByKey(series.Fields[15], t)
	assert.Equal(t, sortedServiceTags[0], KeyValue{Key: "client-uuid", Value: "3b9fd6a628d36d6e"})
	assert.Equal(t, sortedServiceTags[1], KeyValue{Key: "host@name", Value: "fc3cfe411fa7"})
	require.Equal(t, 5, len(sortedServiceTags))

	// tags
	sortedTags := sortObjectsByKey(series.Fields[20], t)
	assert.Equal(t, sortedTags[0], KeyValue{Key: "component", Value: "net/http"})
	assert.Equal(t, sortedTags[1], KeyValue{Key: "error", Value: true})
	require.Equal(t, 3, len(sortedTags))

	// logs
	sortedLogs := sortLogsByTimestamp(series.Fields[11], t)
	require.Equal(t, 2, len(sortedLogs))
	assert.Equal(t, sortedLogs[0].Timestamp, int64(1697615918486))
	assert.Equal(t, sortedLogs[0].Name, "redis timeout")
	// assert log attribute values
	for i, logField := range sortedLogs[1].Fields {
		if logField.Key == "method" {
			assert.Equal(t, sortedLogs[1].Fields[i].Value, "GET")
		}
		if logField.Key == "level" {
			assert.Equal(t, sortedLogs[1].Fields[i].Value, "info")
		}
		if logField.Key == "url" {
			assert.Equal(t, sortedLogs[1].Fields[i].Value, "/route?dropoff=577%2C322u0026pickup=541%2C197")
		}
	}
}

func sortObjectsByKey(rawObject *data.Field, t *testing.T) []KeyValue {
	t.Helper()

	jsonRawMessage, ok := rawObject.At(0).(*json.RawMessage)
	require.True(t, ok)
	require.NotNil(t, jsonRawMessage)

	var sortedObject []KeyValue
	err := json.Unmarshal(*jsonRawMessage, &sortedObject)
	require.Nil(t, err)

	sort.Slice(sortedObject, func(i, j int) bool {
		return sortedObject[i].Key < sortedObject[j].Key
	})
	return sortedObject
}

func sortLogsByTimestamp(rawObject *data.Field, t *testing.T) []Log {
	t.Helper()

	jsonRawMessage, ok := rawObject.At(0).(*json.RawMessage)
	require.True(t, ok)
	require.NotNil(t, jsonRawMessage)

	var sortedArray []Log
	err := json.Unmarshal(*jsonRawMessage, &sortedArray)
	require.Nil(t, err)

	sort.Slice(sortedArray, func(i, j int) bool {
		return sortedArray[i].Timestamp < sortedArray[j].Timestamp
	})
	return sortedArray
}

func TestProcessTraceListResponse(t *testing.T) {
	targets := []tsdbQuery{{
		refId: "A",
		body: `{
			"timeField": "@timestamp",
			"metrics": [{ "type": "count", "id": "1" }],
			"luceneQueryType": "Traces"
			}`,
	}}

	response := `
		{
			"responses": [{
				"aggregations": {
					"traces": {
						"buckets": [{
							"doc_count": 50,
							"key": "000000000000000001c01e08995dd2e2",
							"last_updated": {
								"value": 1700074430928,
								"value_as_string": "2023-11-15T18:53:50.928Z"
							},
							"latency": {
								"value": 656.43
							},
							"trace_group": {
								"buckets":[{
									"doc_count":50,
									"key": "HTTP GET /dispatch"
								}]
							},
							"error_count": {
								"doc_count":0
							}
						}]
					}
				}
			}]
		}
	`

	rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, &backend.DataSourceInstanceSettings{UID: "123", Name: "DatasourceInstanceName"})
	assert.Nil(t, err)

	result, err := rp.parseResponse()
	require.NoError(t, err)
	require.Len(t, result.Responses, 1)

	queryRes := result.Responses["A"]
	require.NotNil(t, queryRes)

	dataframes := queryRes.Frames
	require.Len(t, dataframes, 1)

	frame := dataframes[0]

	traceId := frame.Fields[0]
	assert.Equal(t, "000000000000000001c01e08995dd2e2", traceId.At(0))
	assert.Equal(t, "Trace Id", traceId.Name)
	assert.Equal(t, "string", traceId.Type().ItemTypeString())
	//deep link config to make it possible to click through to individual trace view
	assert.Equal(t, "traceId: ${__value.raw}", traceId.Config.Links[0].Internal.Query.(map[string]interface{})["query"])
	assert.Equal(t, "Traces", traceId.Config.Links[0].Internal.Query.(map[string]interface{})["luceneQueryType"])
	assert.Equal(t, "123", traceId.Config.Links[0].Internal.DatasourceUID)
	assert.Equal(t, "DatasourceInstanceName", traceId.Config.Links[0].Internal.DatasourceName)

	traceGroup := frame.Fields[1]
	assert.Equal(t, "HTTP GET /dispatch", traceGroup.At(0))
	assert.Equal(t, "Trace Group", traceGroup.Name)
	assert.Equal(t, "string", traceGroup.Type().ItemTypeString())

	latency := frame.Fields[2]
	assert.Equal(t, 656.43, latency.At(0))
	assert.Equal(t, "Latency (ms)", latency.Name)
	assert.Equal(t, "float64", latency.Type().ItemTypeString())

	errorCount := frame.Fields[3]
	assert.Equal(t, float64(0), errorCount.At(0))
	assert.Equal(t, "Error Count", errorCount.Name)
	assert.Equal(t, "float64", errorCount.Type().ItemTypeString())

	lastUpdated := frame.Fields[4]
	assert.Equal(t, utils.Pointer(time.Unix(0, int64(1700074430928)*int64(time.Millisecond))), lastUpdated.At(0))
	assert.Equal(t, "Last Updated", lastUpdated.Name)
	assert.Equal(t, "*time.Time", lastUpdated.Type().ItemTypeString())
}

func TestProcessTraceListResponseWithNoTraceGroupOrLastUpdated(t *testing.T) {
	targets := []tsdbQuery{{
		refId: "A",
		body: `{
			"timeField": "@timestamp",
			"metrics": [{ "type": "count", "id": "1" }],
			"luceneQueryType": "Traces"
			}`,
	}}

	response := `
		{
			"responses": [{
				"aggregations": {
					"traces": {
						"buckets": [{
							"doc_count": 50,
							"key": "000000000000000001c01e08995dd2e2",
							"last_updated": {
								"value": null
							},
							"latency": {
								"value": 656.43
							},
							"trace_group": {
								"buckets":[]
							},
							"error_count": {
								"doc_count":0
							}
						}]
					}
				}
			}]
		}
	`

	rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, &backend.DataSourceInstanceSettings{UID: "123", Name: "DatasourceInstanceName"})
	assert.Nil(t, err)

	result, err := rp.parseResponse()
	require.NoError(t, err)
	require.Len(t, result.Responses, 1)

	queryRes := result.Responses["A"]
	require.NotNil(t, queryRes)

	dataframes := queryRes.Frames
	require.Len(t, dataframes, 1)

	frame := dataframes[0]

	traceId := frame.Fields[0]
	assert.Equal(t, "000000000000000001c01e08995dd2e2", traceId.At(0))
	assert.Equal(t, "Trace Id", traceId.Name)
	assert.Equal(t, "string", traceId.Type().ItemTypeString())
	//deep link config to make it possible to click through to individual trace view
	assert.Equal(t, "traceId: ${__value.raw}", traceId.Config.Links[0].Internal.Query.(map[string]interface{})["query"])
	assert.Equal(t, "Traces", traceId.Config.Links[0].Internal.Query.(map[string]interface{})["luceneQueryType"])
	assert.Equal(t, "123", traceId.Config.Links[0].Internal.DatasourceUID)
	assert.Equal(t, "DatasourceInstanceName", traceId.Config.Links[0].Internal.DatasourceName)

	traceGroup := frame.Fields[1]
	assert.Equal(t, "", traceGroup.At(0))
	assert.Equal(t, "Trace Group", traceGroup.Name)
	assert.Equal(t, "string", traceGroup.Type().ItemTypeString())

	latency := frame.Fields[2]
	assert.Equal(t, 656.43, latency.At(0))
	assert.Equal(t, "Latency (ms)", latency.Name)
	assert.Equal(t, "float64", latency.Type().ItemTypeString())

	errorCount := frame.Fields[3]
	assert.Equal(t, float64(0), errorCount.At(0))
	assert.Equal(t, "Error Count", errorCount.Name)
	assert.Equal(t, "float64", errorCount.Type().ItemTypeString())

	lastUpdated := frame.Fields[4]
	assert.Nil(t, lastUpdated.At(0))
	assert.Equal(t, "Last Updated", lastUpdated.Name)
	assert.Equal(t, "*time.Time", lastUpdated.Type().ItemTypeString())
}

func TestProcessSpansResponse_withMultipleSpansQueries(t *testing.T) {
	targets := []tsdbQuery{
		{
			refId: "A",
			body: `{
			"timeField": "@timestamp",
			"metrics": [{ "type": "count", "id": "1" }],
			"query": "traceId:test",
			"luceneQueryType": "Traces"
			}`,
		},
		{
			refId: "B",
			body: `{
			"timeField": "@timestamp",
			"metrics": [{ "type": "count", "id": "1" }],
			"query": "traceId:test123",
			"luceneQueryType": "Traces"
			}`,
		},
	}

	response := `
	{
		"responses": [
			{
				"hits": {
					"hits": [
						{
							"_source": {
								"traceId": "000000000000000047ed3a25a7dba0cd",
								"droppedLinksCount": 0,
								"kind": "SPAN_KIND_SERVER",
								"droppedEventsCount": 0,
								"traceGroupFields": {
									"endTime": "2023-10-18T07:58:38.689468Z",
									"durationInNanos": 870879000,
									"statusCode": 0
								},
								"traceGroup": "HTTP GET /dispatch",
								"serviceName": "frontend",
								"parentSpanId": "",
								"spanId": "47ed3a25a7dba0cd",
								"traceState": "",
								"name": "test domain A",
								"startTime": "2023-10-18T07:58:37.818589Z",
								"links": [],
								"endTime": "2023-10-18T07:58:38.689468Z",
								"droppedAttributesCount": 0,
								"durationInNanos": 870879000,
								"events": [],
								"span.attributes.sampler@param": true,
								"span.attributes.http@method": "GET",
								"resource.attributes.client-uuid": "1ba5d5eb37e7c2a1",
								"status.code": 0
							}
						}
						]
					}
				},
				{
					"hits": {
						"hits": [
							{
								"_source": {
									"traceId": "000000000000000047ed3a25a7dba0cd",
									"droppedLinksCount": 0,
									"kind": "SPAN_KIND_SERVER",
									"droppedEventsCount": 0,
									"traceGroupFields": {
										"endTime": "2023-10-18T07:58:38.689468Z",
										"durationInNanos": 870879000,
										"statusCode": 0
									},
									"traceGroup": "HTTP GET /dispatch",
									"serviceName": "frontend",
									"parentSpanId": "",
									"spanId": "47ed3a25a7dba0cd",
									"traceState": "",
									"name": "test domain B",
									"startTime": "2023-10-18T07:58:37.818589Z",
									"links": [],
									"endTime": "2023-10-18T07:58:38.689468Z",
									"droppedAttributesCount": 0,
									"durationInNanos": 870879000,
									"events": [],
									"span.attributes.sampler@param": true,
									"resource.attributes.client-uuid": "1ba5d5eb37e7c2a1",
									"status.code": 0
								}
							}
							]
						}
					}
			
	]	
	}
	`

	rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, &backend.DataSourceInstanceSettings{UID: "123", Name: "DatasourceInstanceName"})
	assert.Nil(t, err)

	result, err := rp.parseResponse()
	require.NoError(t, err)
	require.Len(t, result.Responses, 2)

	// 1st query
	queryResTraceSpans1 := result.Responses["A"]
	require.NotNil(t, queryResTraceSpans1)

	dataframes := queryResTraceSpans1.Frames
	require.Len(t, dataframes, 1)

	frame := dataframes[0]

	assert.Len(t, frame.Fields, 24)
	assert.Equal(t, getFrameValue("operationName", 0, frame.Fields), "test domain A")

	// 2nd query
	queryResTraceSpans2 := result.Responses["B"]
	require.NotNil(t, queryResTraceSpans2)

	dataframes = queryResTraceSpans2.Frames
	require.Len(t, dataframes, 1)

	frame = dataframes[0]
	assert.Equal(t, getFrameValue("operationName", 0, frame.Fields), "test domain B")

	assert.Len(t, frame.Fields, 24)

}

func TestProcessTraceListAndTraceSpansResponse(t *testing.T) {
	targets := []tsdbQuery{{
		refId: "A",
		body: `{
			"timeField": "@timestamp",
			"metrics": [{ "type": "count", "id": "1" }],
			"luceneQueryType": "Traces"
			}`,
	},
		{
			refId: "B",
			body: `{
			"timeField": "@timestamp",
			"metrics": [{ "type": "count", "id": "1" }],
			"query": "traceId:test",
			"luceneQueryType": "Traces"
			}`,
		},
	}

	response := `
	{
		"responses": [{
			"aggregations": {
				"traces": {
					"buckets": [{
						"doc_count": 50,
						"key": "000000000000000001c01e08995dd2e2",
						"last_updated": {
							"value": 1700074430928,
							"value_as_string": "2023-11-15T18:53:50.928Z"
						},
						"latency": {
							"value": 656.43
						},
						"trace_group": {
							"buckets":[{
								"doc_count":50,
								"key": "HTTP GET /dispatch"
							}]
						},
						"error_count": {
							"doc_count":0
						}
					}]
				}
			}
		},
		{
			"hits": {
				"total": {
					"value": 51,
					"relation": "eq"
				},
				"max_score": 3.4040546,
				"hits": [
					{
						"_source": {
							"traceId": "000000000000000047ed3a25a7dba0cd",
							"droppedLinksCount": 0,
							"kind": "SPAN_KIND_SERVER",
							"droppedEventsCount": 0,
							"traceGroupFields": {
								"endTime": "2023-10-18T07:58:38.689468Z",
								"durationInNanos": 870879000,
								"statusCode": 0
							},
							"traceGroup": "HTTP GET /dispatch",
							"serviceName": "frontend",
							"parentSpanId": "",
							"spanId": "47ed3a25a7dba0cd",
							"traceState": "",
							"name": "HTTP GET /dispatch",
							"startTime": "2023-10-18T07:58:37.818589Z",
							"links": [],
							"endTime": "2023-10-18T07:58:38.689468Z",
							"droppedAttributesCount": 0,
							"durationInNanos": 870879000,
							"events": [],
							"span.attributes.sampler@param": true,
							"span.attributes.http@method": "GET",
							"resource.attributes.client-uuid": "1ba5d5eb37e7c2a1",
							"status.code": 0
						}
					}
				]
			}
		}]	
	}`

	rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, &backend.DataSourceInstanceSettings{UID: "123", Name: "DatasourceInstanceName"})
	assert.Nil(t, err)

	result, err := rp.parseResponse()
	require.NoError(t, err)
	require.Len(t, result.Responses, 2)

	// trace list
	queryResTraceList := result.Responses["A"]
	require.NotNil(t, queryResTraceList)

	dataframes := queryResTraceList.Frames
	require.Len(t, dataframes, 1)

	frame := dataframes[0]

	traceId := frame.Fields[0]
	assert.Equal(t, "000000000000000001c01e08995dd2e2", traceId.At(0))

	// trace spans
	queryResTraceSpans := result.Responses["B"]
	require.NotNil(t, queryResTraceSpans)

	dataframes = queryResTraceSpans.Frames
	require.Len(t, dataframes, 1)

	frame = dataframes[0]

	assert.Len(t, frame.Fields, 24)

}

func getFrameValue(name string, index int, fields []*data.Field) string {
	for _, field := range fields {
		if field.Name == name {
			return *field.At(index).(*string)
		}
	}
	return ""
}

func TestProcessServiceMapResponse(t *testing.T) {
	targets := []tsdbQuery{{
		refId: "A",
		body: `{
		"serviceMap": true,
		"query": "*",
		"luceneQueryType": "Traces",
		"services":["frontend", "redis"],
		"operations":["HTTP GET","findDriver"]
		}`,
	}}
	response := `{
		"responses": [
			{
				"status":200,
				"timed_out":false,
				"took":32,
				"aggregations":{
					"service_name":{
						"buckets":[
							{
								"avg_latency_nanos":{
								"value":1.774492857142857E7
								},
								"doc_count":14,
								"error_count":{
								"doc_count":3
								},
								"error_rate":{
								"value":0.21428571428571427
								},
								"key":"redis"
							},
							{
								"avg_latency_nanos":{
								"value":5.25893E7
								},
								"doc_count":10,
								"error_count":{
								"doc_count":0
								},
								"error_rate":{
								"value":0.0
								},
								"key":"route"
							},
							{
								"avg_latency_nanos":{
								"value":4.836165E8
								},
								"doc_count":2,
								"error_count":{
								"doc_count":0
								},
								"error_rate":{
								"value":0.0
								},
								"key":"frontend"
							},
							{
								"avg_latency_nanos":{
								"value":2.68135E8
								},
								"doc_count":1,
								"error_count":{
								"doc_count":0
								},
								"error_rate":{
								"value":0.0
								},
								"key":"customer"
							},
							{
								"avg_latency_nanos":{
								"value":2.49301E8
								},
								"doc_count":1,
								"error_count":{
								"doc_count":0
								},
								"error_rate":{
								"value":0.0
								},
								"key":"driver"
							},
							{
								"avg_latency_nanos":{
								"value":2.68056E8
								},
								"doc_count":1,
								"error_count":{
								"doc_count":0
								},
								"error_rate":{
								"value":0.0
								},
								"key":"mysql"
							}
						],
						"doc_count_error_upper_bound":0,
						"sum_other_doc_count":0
					}
				}
			},
			{
				"status":200,
				"timed_out":false,
				"took":25,
				"aggregations":{
					"service_name":{
						"buckets":[
							{
							"destination_domain":{
								"buckets":[
									{
										"destination_resource":{
										"buckets":[
											{
												"doc_count":1,
												"key":"HTTP GET /customer"
											}
										],
										"doc_count_error_upper_bound":0,
										"sum_other_doc_count":0
										},
										"doc_count":1,
										"key":"customer"
									},
									{
										"destination_resource":{
										"buckets":[
											{
												"doc_count":1,
												"key":"/driver.DriverService/FindNearest"
											}
										],
										"doc_count_error_upper_bound":0,
										"sum_other_doc_count":0
										},
										"doc_count":1,
										"key":"driver"
									},
									{
										"destination_resource":{
										"buckets":[
											{
												"doc_count":1,
												"key":"HTTP GET /route"
											}
										],
										"doc_count_error_upper_bound":0,
										"sum_other_doc_count":0
										},
										"doc_count":1,
										"key":"route"
									}
								],
								"doc_count_error_upper_bound":0,
								"sum_other_doc_count":0
							},
							"doc_count":970,
							"key":"frontend",
							"target_domain":{
								"buckets":[
									
								],
								"doc_count_error_upper_bound":0,
								"sum_other_doc_count":0
							}
							},
							{
							"destination_domain":{
								"buckets":[
									
								],
								"doc_count_error_upper_bound":0,
								"sum_other_doc_count":0
							},
							"doc_count":516,
							"key":"redis",
							"target_domain":{
								"buckets":[
									{
										"doc_count":2,
										"key":"redis",
										"target_resource":{
										"buckets":[
											{
												"doc_count":1,
												"key":"FindDriverIDs"
											},
											{
												"doc_count":1,
												"key":"GetDriver"
											}
										],
										"doc_count_error_upper_bound":0,
										"sum_other_doc_count":0
										}
									}
								],
								"doc_count_error_upper_bound":0,
								"sum_other_doc_count":0
							}
							},
							{
							"destination_domain":{
								"buckets":[
									
								],
								"doc_count_error_upper_bound":0,
								"sum_other_doc_count":0
							},
							"doc_count":382,
							"key":"route",
							"target_domain":{
								"buckets":[
									{
										"doc_count":1,
										"key":"route",
										"target_resource":{
										"buckets":[
											{
												"doc_count":1,
												"key":"HTTP GET /route"
											}
										],
										"doc_count_error_upper_bound":0,
										"sum_other_doc_count":0
										}
									}
								],
								"doc_count_error_upper_bound":0,
								"sum_other_doc_count":0
							}
							},
							{
							"destination_domain":{
								"buckets":[
									{
										"destination_resource":{
										"buckets":[
											{
												"doc_count":1,
												"key":"SQL SELECT"
											}
										],
										"doc_count_error_upper_bound":0,
										"sum_other_doc_count":0
										},
										"doc_count":1,
										"key":"mysql"
									}
								],
								"doc_count_error_upper_bound":0,
								"sum_other_doc_count":0
							},
							"doc_count":41,
							"key":"customer",
							"target_domain":{
								"buckets":[
									{
										"doc_count":1,
										"key":"customer",
										"target_resource":{
										"buckets":[
											{
												"doc_count":1,
												"key":"HTTP GET /customer"
											}
										],
										"doc_count_error_upper_bound":0,
										"sum_other_doc_count":0
										}
									}
								],
								"doc_count_error_upper_bound":0,
								"sum_other_doc_count":0
							}
							},
							{
							"destination_domain":{
								"buckets":[
									{
										"destination_resource":{
										"buckets":[
											{
												"doc_count":1,
												"key":"FindDriverIDs"
											},
											{
												"doc_count":1,
												"key":"GetDriver"
											}
										],
										"doc_count_error_upper_bound":0,
										"sum_other_doc_count":0
										},
										"doc_count":2,
										"key":"redis"
									}
								],
								"doc_count_error_upper_bound":0,
								"sum_other_doc_count":0
							},
							"doc_count":41,
							"key":"driver",
							"target_domain":{
								"buckets":[
									{
										"doc_count":1,
										"key":"driver",
										"target_resource":{
										"buckets":[
											{
												"doc_count":1,
												"key":"/driver.DriverService/FindNearest"
											}
										],
										"doc_count_error_upper_bound":0,
										"sum_other_doc_count":0
										}
									}
								],
								"doc_count_error_upper_bound":0,
								"sum_other_doc_count":0
							}
							},
							{
							"destination_domain":{
								"buckets":[
									
								],
								"doc_count_error_upper_bound":0,
								"sum_other_doc_count":0
							},
							"doc_count":40,
							"key":"mysql",
							"target_domain":{
								"buckets":[
									{
										"doc_count":1,
										"key":"mysql",
										"target_resource":{
										"buckets":[
											{
												"doc_count":1,
												"key":"SQL SELECT"
											}
										],
										"doc_count_error_upper_bound":0,
										"sum_other_doc_count":0
										}
									}
								],
								"doc_count_error_upper_bound":0,
								"sum_other_doc_count":0
							}
							},
							{
								"destination_domain":{
									"buckets":[
										{
											"destination_resource":{
											"buckets":[
												{
													"doc_count":1,
													"key":"FindDriverIDs"
												},
												{
													"doc_count":1,
													"key":"GetDriver"
												}
											],
											"doc_count_error_upper_bound":0,
											"sum_other_doc_count":0
											},
											"doc_count":2,
											"key":"redis"
										}
									],
									"doc_count_error_upper_bound":0,
									"sum_other_doc_count":0
								},
								"doc_count":41,
								"key":"no-stats",
								"target_domain":{
									"buckets":[
										{
											"doc_count":1,
											"key":"driver",
											"target_resource":{
											"buckets":[
												{
													"doc_count":1,
													"key":"/driver.DriverService/FindNearest"
												}
											],
											"doc_count_error_upper_bound":0,
											"sum_other_doc_count":0
											}
										}
									],
									"doc_count_error_upper_bound":0,
									"sum_other_doc_count":0
								}
							}
						],
						"doc_count_error_upper_bound":0,
						"sum_other_doc_count":0
					}
				}
			},
			{
				"aggregations": {
					"traces": {
					  "doc_count_error_upper_bound": 0,
					  "sum_other_doc_count": 0,
					  "buckets": [
						{
						  "key": "00000000000000001c826277770e267d",
						  "doc_count": 50,
						  "last_updated": { "value": 1.700595586811e12, "value_as_string": "2023-11-21T19:39:46.811Z" },
						  "latency": { "value": 671.91 },
						  "error_count": { "doc_count": 0 },
						  "trace_group": {
							"doc_count_error_upper_bound": 0,
							"sum_other_doc_count": 0,
							"buckets": [{ "key": "HTTP GET /dispatch", "doc_count": 50 }]
						  }
						}
					  ]
					}
				  },
				  "status": 200
			}
		]
	}`
	rp, err := newResponseParserForTest(targets, response, nil, client.ConfiguredFields{TimeField: "@timestamp"}, &backend.DataSourceInstanceSettings{UID: "123", Name: "DatasourceInstanceName"})
	assert.Nil(t, err)

	result, err := rp.parseResponse()
	require.NoError(t, err)
	require.Len(t, result.Responses, 1)

	finalDataFrames := result.Responses["A"].Frames
	require.Len(t, finalDataFrames, 3)

	require.NotNil(t, finalDataFrames)

	// trace list
	traceListDataframe := finalDataFrames[0]
	require.Equal(t, traceListDataframe.Name, "Trace List")

	// edges
	edgesFrame := finalDataFrames[1]
	assert.Equal(t, edgesFrame.Name, "edges")
	assert.Equal(t, edgesFrame.Fields[0].Len(), 5)
	assert.Equal(t, edgesFrame.Fields[3].Len(), 5)
	assert.Equal(t, "frontend_customer", edgesFrame.Fields[0].At(0))
	assert.Equal(t, "frontend_driver", edgesFrame.Fields[0].At(1))
	// nodes
	nodesFrame := finalDataFrames[2]
	require.Equal(t, nodesFrame.Name, "nodes")
	assert.Equal(t, nodesFrame.Fields[0].Len(), 6)
	assert.Equal(t, "frontend", nodesFrame.Fields[0].At(0))
	assert.Equal(t, "redis", nodesFrame.Fields[0].At(1))
}
