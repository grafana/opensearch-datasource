package opensearch

import (
	"encoding/json"
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

//func TestFlatten(t *testing.T) {
//	t.Run("flatten", func(t *testing.T) {
//		target := map[string]interface{}{
//			"fieldName": "",
//		}
//
//		assert.Equal(t, target, flatten(target, 0))
//	})
//
//	t.Run("flatten with nested", func(t *testing.T) {
//		target := map[string]interface{}{
//			"fieldName": map[string]interface{}{
//				"fieldName": "",
//			},
//		}
//
//		assert.Equal(t, map[string]interface{}{"fieldName.fieldName": ""}, flatten(target, 0))
//	})
//
//	t.Run("flatten with many nested", func(t *testing.T) {
//		target := map[string]interface{}{
//			"fieldName": map[string]interface{}{
//				"fieldName": "",
//			},
//			"fieldName2": map[string]interface{}{
//				"fieldName": "",
//			},
//		}
//
//		assert.Equal(t, map[string]interface{}{"fieldName.fieldName": "", "fieldName2.fieldName": ""}, flatten(target, 0))
//	})
//}

func Test_ResponseParser_test(t *testing.T) {
	t.Run("Simple query and count", func(t *testing.T) {
		targets := map[string]string{
			"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "count", "id": "1" }],
          "bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "2" }]
				}`,
		}
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
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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
		targets := map[string]string{
			"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "count", "id": "1" }, {"type": "avg", "field": "value", "id": "2" }],
		 "bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "3" }]
				}`,
		}
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
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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
		targets := map[string]string{
			"A": `{
					"timeField": "@timestamp",
					"metrics": [{"type": "avg", "field": "rating", "id": "1" }, {"type": "derivative", "field":"1", "id": "3"}],
		 "bucketAggs": [{ "type": "date_histogram", "field": "release_date", "id": "2" }]
				}`,
		}
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
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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
		targets := map[string]string{
			"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "count", "id": "1" }],
		 "bucketAggs": [
						{ "type": "terms", "field": "host", "id": "2" },
						{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
					]
				}`,
		}
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
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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
		targets := map[string]string{
			"A": `{
				"timeField": "@timestamp",
				"metrics": [{ "type": "count", "id": "1" }, { "type": "avg", "field": "@value", "id": "4" }],
	 "bucketAggs": [
					{ "type": "terms", "field": "host", "id": "2" },
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				]
			}`,
		}
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
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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

	t.Run("With percentiles", func(t *testing.T) {
		targets := map[string]string{
			"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "percentiles", "settings": { "percents": [75, 90] }, "id": "1" }],
		 "bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "3" }]
				}`,
		}
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
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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
		targets := map[string]string{
			"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "extended_stats", "meta": { "max": true, "std_deviation_bounds_upper": true, "std_deviation_bounds_lower": true }, "id": "1" }],
		 "bucketAggs": [
						{ "type": "terms", "field": "host", "id": "3" },
						{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
					]
				}`,
		}
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
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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
		targets := map[string]string{
			"A": `{
					"timeField": "@timestamp",
					"alias": "{{term @host}} {{metric}} and {{not_exist}} {{@host}}",
					"metrics": [{ "type": "count", "id": "1" }],
		 "bucketAggs": [
						{ "type": "terms", "field": "@host", "id": "2" },
						{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
					]
				}`,
		}
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
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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

	t.Run("Histogram response", func(t *testing.T) {
		targets := map[string]string{
			"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "count", "id": "1" }],
		 "bucketAggs": [{ "type": "histogram", "field": "bytes", "id": "3" }]
				}`,
		}
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
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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
		targets := map[string]string{
			"A": `{
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
		}
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
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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

	t.Run("With dropfirst and last aggregation", func(t *testing.T) {
		targets := map[string]string{
			"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "avg", "id": "1" }, { "type": "count" }],
		 "bucketAggs": [
						{
							"type": "date_histogram",
							"field": "@timestamp",
							"id": "2",
							"settings": { "trimEdges": 1 }
						}
					]
				}`,
		}
		response := `{
		   "responses": [
			 {
			   "aggregations": {
				 "2": {
				   "buckets": [
					 {
					   "1": { "value": 11 },
					   "key": 1000,
					   "doc_count": 369
					 },
					 {
					   "1": { "value": 22 },
					   "key": 2000,
					   "doc_count": 200
					 },
					 {
					   "1": { "value": 33 },
					   "key": 3000,
					   "doc_count": 200
					 }
				   ]
				 }
			   }
			 }
		   ]
				}`
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		assert.Len(t, queryRes.Frames, 2)

		seriesOne := queryRes.Frames[0]
		require.Len(t, seriesOne.Fields, 2)
		assert.Equal(t, "Average", seriesOne.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 1, seriesOne.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesOne.Fields[0].At(0).(*time.Time))
		require.Equal(t, 1, seriesOne.Fields[1].Len())
		assert.EqualValues(t, 22, *seriesOne.Fields[1].At(0).(*float64))

		seriesTwo := queryRes.Frames[1]
		require.Len(t, seriesTwo.Fields, 2)
		assert.Equal(t, "Count", seriesTwo.Fields[1].Config.DisplayNameFromDS)
		require.Equal(t, 1, seriesTwo.Fields[0].Len())
		assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesTwo.Fields[0].At(0).(*time.Time))
		require.Equal(t, 1, seriesTwo.Fields[1].Len())
		assert.EqualValues(t, 200, *seriesTwo.Fields[1].At(0).(*float64))
	})

	t.Run("No group by time", func(t *testing.T) {
		targets := map[string]string{
			"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "avg", "id": "1" }, { "type": "count" }],
		 "bucketAggs": [{ "type": "terms", "field": "host", "id": "2" }]
				}`,
		}
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
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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
		targets := map[string]string{
			"A": `{
						"timeField": "@timestamp",
						"metrics": [{ "type": "avg", "field": "test", "id": "1" }, { "type": "avg", "field": "test2", "id": "2" }],
			 "bucketAggs": [{ "type": "terms", "field": "host", "id": "2" }]
					}`,
		}
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
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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
		targets := map[string]string{
			"A": `{
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
		}
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
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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
		targets := map[string]string{
			"A": `{
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
		}
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
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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

	//TODO: raw_document query remains to be implemented https://github.com/grafana/oss-plugin-partnerships/issues/196
	//t.Run("Raw documents query", func(t *testing.T) {
	//	targets := map[string]string{
	//		"A": `{
	//						"timeField": "@timestamp",
	//						"metrics": [{ "type": "raw_document", "id": "1" }]
	//					}`,
	//	}
	//	response := `{
	//			    "responses": [
	//			      {
	//			        "hits": {
	//			          "total": 100,
	//			          "hits": [
	//			            {
	//			              "_id": "1",
	//			              "_type": "type",
	//			              "_index": "index",
	//			              "_source": { "sourceProp": "asd" },
	//			              "fields": { "fieldProp": "field" }
	//			            },
	//			            {
	//			              "_source": { "sourceProp": "asd2" },
	//			              "fields": { "fieldProp": "field2" }
	//			            }
	//			          ]
	//			        }
	//			      }
	//			    ]
	//				}`
	//	rp, err := newResponseParserForTest(targets, response)
	//	assert.Nil(t, err)
	//	result, err := rp.getTimeSeries("@timestamp")
	//	assert.Nil(t, err)
	//	require.Len(t, result.Responses, 1)
	//
	//	queryRes := result.Responses["A"]
	//	assert.NotNil(t, queryRes)
	//	assert.Len(t, queryRes.Frames, 1)
	//So(queryRes.Tables, ShouldHaveLength, 1)
	//
	//rows := queryRes.Tables[0].Rows
	//So(rows, ShouldHaveLength, 1)
	//cols := queryRes.Tables[0].Columns
	//So(cols, ShouldHaveLength, 3)
	//
	//So(cols[0].Text, ShouldEqual, "host")
	//So(cols[1].Text, ShouldEqual, "Average test")
	//So(cols[2].Text, ShouldEqual, "Average test2")
	//
	//So(rows[0][0].(string), ShouldEqual, "server-1")
	//So(rows[0][1].(null.Float).Float64, ShouldEqual, 1000)
	//So(rows[0][2].(null.Float).Float64, ShouldEqual, 3000)
	//})
}

func TestProcessRawDataResponse(t *testing.T) {
	t.Run("Simple raw data query", func(t *testing.T) {
		targets := map[string]string{
			"A": `{
				  "timeField": "@timestamp",
				  "metrics": [{"type": "raw_data"}]
			}`,
		}

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
							 "nested2":{
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

		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
		require.NoError(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		require.NotNil(t, queryRes)
		dataframes := queryRes.Frames
		require.Len(t, dataframes, 1)
		frame := dataframes[0]

		assert.Equal(t, 16, len(frame.Fields))
		// Fields have the correct length
		assert.Equal(t, 2, frame.Fields[0].Len())
		// First field is timeField
		assert.Equal(t, data.FieldTypeNullableTime, frame.Fields[0].Type())
		// Correctly uses string types
		assert.Equal(t, data.FieldTypeNullableString, frame.Fields[1].Type())
		// Correctly detects float64 types
		assert.Equal(t, data.FieldTypeNullableFloat64, frame.Fields[5].Type())
		// Correctly detects json types
		assert.Equal(t, data.FieldTypeNullableJSON, frame.Fields[6].Type())
		assert.Equal(t, "nested", frame.Fields[11].Name)
		assert.Equal(t, data.FieldTypeNullableJSON, frame.Fields[11].Type())
		// Correctly detects type even if first value is null
		assert.Equal(t, data.FieldTypeNullableString, frame.Fields[15].Type())
	})

	t.Run("Raw data query filterable fields", func(t *testing.T) {
		targets := map[string]string{
			"A": `{
				  "timeField": "@timestamp",
				  "metrics": [{ "type": "raw_data", "id": "1" }],
			      "bucketAggs": []
			}`,
		}

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
							  "_source": { "sourceProp": "asd" }
							}
						  ]
						}
					  }
					]
				}
			`

		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
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

func TestFluffles(t *testing.T) {
	t.Run("weak raw_data test", func(t *testing.T) {
		targets := map[string]string{
			"D": `{
				"timeField": "@timestamp",
				"metrics": [
					{ "id": "6", "type": "raw_data", "field": "@value" }
				],
		 "bucketAggs": []
				}`,
		}
		response := `{
		  "responses": [
			{
			  "hits": {
				"total": {
				  "relation": "eq",
				  "value": 1
				},
				"hits": [
				  {
					"_id": "6",
					"_type": "_doc",
					"_index": "index",
					"_source": {
					  "sourceProp": "asd"
					}
				  }
				]
			  }
			}
		  ]
		}`
		rp, err := newResponseParserForTest(targets, response)
		assert.Nil(t, err)
		result, err := rp.getTimeSeries("@timestamp")
		assert.Nil(t, err)
		require.Len(t, result.Responses, 1)

		queryRes := result.Responses["D"]
		assert.NotNil(t, queryRes)
		//assert.Len(t, queryRes.Frames, 3)
		//seriesOne := queryRes.Frames[0]
		//require.Len(t, seriesOne.Fields, 2)
		//assert.Equal(t, "Sum @value", seriesOne.Fields[1].Config.DisplayNameFromDS)
		//require.Equal(t, 2, seriesOne.Fields[0].Len())
		//assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 1, 0, time.UTC), *seriesOne.Fields[0].At(0).(*time.Time))
		//assert.Equal(t, time.Date(1970, time.January, 1, 0, 0, 2, 0, time.UTC), *seriesOne.Fields[0].At(1).(*time.Time))
		//require.Equal(t, 2, seriesOne.Fields[1].Len())
		//assert.EqualValues(t, 2, *seriesOne.Fields[1].At(0).(*float64))
		//assert.EqualValues(t, 3, *seriesOne.Fields[1].At(1).(*float64))
	})
	/*
	 describe('When processing responses as DataFrames (raw_data query present)', () => {
	      beforeEach(() => {
	        targets = [
	          ...commonTargets,
	          // Raw Data Query
	          {
	            refId: 'D',
	            metrics: [{ type: 'raw_data', id: '6' }],
	            bucketAggs: [],
	          },
	        ];

	        response = {
	          responses: [
	            ...commonResponses,
	            // Raw Data Query
	            {
	              hits: {
	                total: {
	                  relation: 'eq',
	                  value: 1,
	                },
	                hits: [
	                  {
	                    _id: '6',
	                    _type: '_doc',
	                    _index: 'index',
	                    _source: { sourceProp: 'asd' },
	                  },
	                ],
	              },
	            },
	          ],
	        };

	        result = new OpenSearchResponse(targets, response).getTimeSeries();
	      });

	      it('should add the correct refId to each returned series', () => {
	        expect(result.data[0].refId).toBe(countQuery.target.refId);

	        expect(result.data[1].refId).toBe(countGroupByHistogramQuery.target.refId);

	        expect(result.data[2].refId).toBe(rawDocumentQuery.target.refId);

	        expect(result.data[3].refId).toBe(percentilesQuery.target.refId);
	        expect(result.data[4].refId).toBe(percentilesQuery.target.refId);

	        expect(result.data[5].refId).toBe(extendedStatsQuery.target.refId);

	        // Raw Data query
	        expect(result.data[result.data.length - 1].refId).toBe('D');
	      });
	    });
	*/
}

func newResponseParserForTest(tsdbQueries map[string]string, responseBody string) (*responseParser, error) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	tsdbQuery := &backend.QueryDataRequest{
		Queries: []backend.DataQuery{},
	}

	for refID, tsdbQueryBody := range tsdbQueries {
		tsdbQuery.Queries = append(tsdbQuery.Queries, backend.DataQuery{
			JSON:  []byte(tsdbQueryBody),
			RefID: refID,
			TimeRange: backend.TimeRange{
				From: from,
				To:   to,
			},
		})
	}

	var response client.MultiSearchResponse
	err := json.Unmarshal([]byte(responseBody), &response)
	if err != nil {
		return nil, err
	}

	tsQueryParser := newTimeSeriesQueryParser()
	queries, err := tsQueryParser.parse(tsdbQuery)
	if err != nil {
		return nil, err
	}

	return newResponseParser(response.Responses, queries, nil), nil
}

func TestHistogramSimple(t *testing.T) {
	query := map[string]string{
		"A": `{
			"timeField": "@timestamp",
			"metrics": [{ "type": "count", "id": "1" }],
			"bucketAggs": [{ "type": "histogram", "field": "bytes", "id": "3" }]
		}`}
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
	rp, err := newResponseParserForTest(query, response)
	assert.NoError(t, err)
	result, err := rp.getTimeSeries("@timestamp")
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
	t.Run("flatten does not affect any non-nested JSON", func(t *testing.T) {
		target := map[string]interface{}{
			"fieldName": "",
		}

		assert.Equal(t, target, flatten(target, 0))
	})

	t.Run("flatten combines nested field names", func(t *testing.T) {
		target := map[string]interface{}{
			"fieldName": map[string]interface{}{
				"innerFieldName": "",
			},
		}

		assert.Equal(t, map[string]interface{}{"fieldName.innerFieldName": ""}, flatten(target, 0))
	})

	t.Run("flatten combines multiple nested field names", func(t *testing.T) {
		target := map[string]interface{}{
			"fieldName": map[string]interface{}{
				"innerFieldName": "",
			},
			"fieldName2": map[string]interface{}{
				"innerFieldName2": "",
			},
		}

		assert.Equal(t, map[string]interface{}{"fieldName.innerFieldName": "", "fieldName2.innerFieldName2": ""}, flatten(target, 0))
	})
}
