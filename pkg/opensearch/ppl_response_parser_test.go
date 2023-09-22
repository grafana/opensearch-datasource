package opensearch

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	es "github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/stretchr/testify/assert"
)

func TestPPLResponseParser(t *testing.T) {
	t.Run("PPL response parser test", func(t *testing.T) {
		t.Run("Simple time series query", func(t *testing.T) {
			t.Run("Time field as first field", func(t *testing.T) {
				targets := map[string]string{
					"A": `{
						"timeField": "@timestamp"
					}`,
				}
				response := `{
					"schema": [
						{ "name": "timeName", "type": "timestamp" },
						{ "name": "testMetric", "type": "integer" }
					],
					"datarows": [
						["%s", 10],
						["%s", 15]
					],
					"total": 2,
					"size": 2
				}`
				response = fmt.Sprintf(response, formatUnixMs(100, pplTSFormat), formatUnixMs(200, pplTSFormat))
				rp, err := newPPLResponseParserForTest(targets, response)
				assert.NoError(t, err)
				queryRes, err := rp.parseTimeSeries()
				assert.NoError(t, err)
				assert.NotNil(t, queryRes)
				assert.Len(t, queryRes.Frames, 1)
				frame := queryRes.Frames[0]
				assert.Equal(t, "testMetric", frame.Name)
				assert.Equal(t, 2, frame.Rows())
				result, _ := frame.FloatAt(0, 0)
				assert.Equal(t, float64(100), result)
				result2, _ := frame.FloatAt(0, 1)
				assert.Equal(t, float64(200), result2)
				result3, _ := frame.FloatAt(1, 0)
				assert.Equal(t, float64(10), result3)
				result4, _ := frame.FloatAt(1, 1)
				assert.Equal(t, float64(15), result4)
			})

			t.Run("Time field as second field", func(t *testing.T) {
				targets := map[string]string{
					"A": `{
								"timeField": "@timestamp"
							}`,
				}
				response := `{
							"schema": [
								{ "name": "testMetric", "type": "integer" },
								{ "name": "timeName", "type": "timestamp" }
							],
							"datarows": [
								[20, "%s"],
								[25, "%s"]
							],
							"total": 2,
							"size": 2
						}`
				response = fmt.Sprintf(response, formatUnixMs(100, pplTSFormat), formatUnixMs(200, pplTSFormat))
				rp, err := newPPLResponseParserForTest(targets, response)
				assert.NoError(t, err)
				queryRes, err := rp.parseTimeSeries()
				assert.NoError(t, err)
				assert.NotNil(t, queryRes)
				assert.Len(t, queryRes.Frames, 1)
				frame := queryRes.Frames[0]
				assert.Equal(t, "testMetric", frame.Name)
				assert.Equal(t, 2, frame.Rows())
				result, _ := frame.FloatAt(0, 0)
				assert.Equal(t, float64(100), result)
				result2, _ := frame.FloatAt(0, 1)
				assert.Equal(t, float64(200), result2)
				result3, _ := frame.FloatAt(1, 0)
				assert.Equal(t, float64(20), result3)
				result4, _ := frame.FloatAt(1, 1)
				assert.Equal(t, float64(25), result4)
			})
		})

		t.Run("Set series name to be value field name", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
							"timeField": "@timestamp"
						}`,
			}
			response := `{
						"schema": [
							{ "name": "valueField", "type": "integer" },
							{ "name": "timeName", "type": "timestamp" }
						],
						"datarows": [
							[20, "%s"]
						],
						"total": 1,
						"size": 1
					}`
			response = fmt.Sprintf(response, formatUnixMs(100, pplTSFormat))
			rp, err := newPPLResponseParserForTest(targets, response)
			assert.NoError(t, err)
			queryRes, err := rp.parseTimeSeries()
			assert.NoError(t, err)
			assert.NotNil(t, queryRes)
			assert.Len(t, queryRes.Frames, 1)
			frame := queryRes.Frames[0]
			assert.Equal(t, "valueField", frame.Name)
		})

		t.Run("Different date formats", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
							"timeField": "@timestamp"
						}`,
			}
			response := `{
						"schema": [
							{ "name": "timeName", "type": "%s" },
							{ "name": "testMetric", "type": "integer" }
						],
						"datarows": [
							["%s", 10]
						],
						"total": 1,
						"size": 1
					}`

			t.Run("Timestamp time field type", func(t *testing.T) {
				formattedResponse := fmt.Sprintf(response, "timestamp", formatUnixMs(100, pplTSFormat))
				rp, err := newPPLResponseParserForTest(targets, formattedResponse)
				assert.NoError(t, err)
				queryRes, err := rp.parseTimeSeries()
				assert.NoError(t, err)
				assert.NotNil(t, queryRes)
				assert.Len(t, queryRes.Frames, 1)
				frame := queryRes.Frames[0]
				assert.Equal(t, "testMetric", frame.Name)
				assert.Equal(t, 1, frame.Rows())
				result, _ := frame.FloatAt(0, 0)
				assert.Equal(t, float64(100), result)
				result2, _ := frame.FloatAt(1, 0)
				assert.Equal(t, float64(10), result2)
			})

			t.Run("Datetime time field type", func(t *testing.T) {
				formattedResponse := fmt.Sprintf(response, "datetime", formatUnixMs(100, pplTSFormat))
				rp, err := newPPLResponseParserForTest(targets, formattedResponse)
				assert.NoError(t, err)
				queryRes, err := rp.parseTimeSeries()
				assert.NoError(t, err)
				assert.NotNil(t, queryRes)
				assert.Len(t, queryRes.Frames, 1)
				frame := queryRes.Frames[0]
				assert.Equal(t, "testMetric", frame.Name)
				assert.Equal(t, 1, frame.Rows())
				result, _ := frame.FloatAt(0, 0)
				assert.Equal(t, float64(100), result)
				result2, _ := frame.FloatAt(1, 0)
				assert.Equal(t, float64(10), result2)
			})

			t.Run("Date time field type", func(t *testing.T) {
				formattedResponse := fmt.Sprintf(response, "date", formatUnixMs(0, pplDateFormat))
				rp, err := newPPLResponseParserForTest(targets, formattedResponse)
				assert.NoError(t, err)
				queryRes, err := rp.parseTimeSeries()
				assert.NoError(t, err)
				assert.NotNil(t, queryRes)
				assert.Len(t, queryRes.Frames, 1)
				frame := queryRes.Frames[0]
				assert.Equal(t, "testMetric", frame.Name)
				assert.Equal(t, 1, frame.Rows())
				result, _ := frame.FloatAt(0, 0)
				assert.Equal(t, float64(0), result)
				result2, _ := frame.FloatAt(1, 0)
				assert.Equal(t, float64(10), result2)
			})
		})

		t.Run("Handle invalid schema for time series", func(t *testing.T) {
			t.Run("More than two fields", func(t *testing.T) {
				targets := map[string]string{
					"A": `{
								"timeField": "@timestamp"
							}`,
				}
				response := `{
						"schema": [
							{ "name": "testMetric", "type": "integer" },
							{ "name": "extraMetric", "type": "integer" },
							{ "name": "timeName", "type": "timestamp" }
						],
						"datarows": [
							[20, 20, "%s"]
						],
						"total": 1,
						"size": 1
					}`
				response = fmt.Sprintf(response, formatUnixMs(100, pplTSFormat))
				rp, err := newPPLResponseParserForTest(targets, response)
				assert.NoError(t, err)
				_, err = rp.parseTimeSeries()
				assert.Error(t, err)
			})

			t.Run("Less than two fields", func(t *testing.T) {
				targets := map[string]string{
					"A": `{
								"timeField": "@timestamp"
							}`,
				}
				response := `{
							"schema": [
								{ "name": "timeName", "type": "timestamp" }
							],
							"datarows": [
								["%s"]
							],
							"total": 1,
							"size": 1
						}`
				response = fmt.Sprintf(response, formatUnixMs(100, pplTSFormat))
				rp, err := newPPLResponseParserForTest(targets, response)
				assert.NoError(t, err)
				_, err = rp.parseTimeSeries()
				assert.Error(t, err)
			})

			t.Run("No valid time field type", func(t *testing.T) {
				targets := map[string]string{
					"A": `{
								"timeField": "@timestamp"
							}`,
				}
				response := `{
							"schema": [
								{ "name": "timeName", "type": "string" },
								{ "name": "testMetric", "type": "integer" }
							],
							"datarows": [
								["%s", 10]
							],
							"total": 1,
							"size": 1
						}`
				response = fmt.Sprintf(response, formatUnixMs(100, pplTSFormat))
				rp, err := newPPLResponseParserForTest(targets, response)
				assert.NoError(t, err)
				_, err = rp.parseTimeSeries()
				assert.Error(t, err)
			})

			t.Run("Valid time field type with invalid value type", func(t *testing.T) {
				targets := map[string]string{
					"A": `{
								"timeField": "@timestamp"
							}`,
				}
				response := `{
							"schema": [
								{ "name": "timeName", "type": "timestamp" },
								{ "name": "testMetric", "type": "string" }
							],
							"datarows": [
								["%s", "10"]
							],
							"total": 1,
							"size": 1
						}`
				response = fmt.Sprintf(response, formatUnixMs(100, pplTSFormat))
				rp, err := newPPLResponseParserForTest(targets, response)
				assert.NoError(t, err)
				_, err = rp.parseTimeSeries()
				assert.Error(t, err)
			})

			t.Run("Valid schema invalid time field type", func(t *testing.T) {
				targets := map[string]string{
					"A": `{
								"timeField": "@timestamp"
							}`,
				}
				response := `{
							"schema": [
								{ "name": "timeName", "type": "timestamp" },
								{ "name": "testMetric", "type": "string" }
							],
							"datarows": [
								[10, "10"]
							],
							"total": 1,
							"size": 1
						}`
				rp, err := newPPLResponseParserForTest(targets, response)
				assert.NoError(t, err)
				_, err = rp.parseTimeSeries()
				assert.Error(t, err)
			})

			t.Run("Valid schema invalid time field value", func(t *testing.T) {
				targets := map[string]string{
					"A": `{
								"timeField": "@timestamp"
							}`,
				}
				response := `{
							"schema": [
								{ "name": "timeName", "type": "timestamp" },
								{ "name": "testMetric", "type": "string" }
							],
							"datarows": [
								["foo", "10"]
							],
							"total": 1,
							"size": 1
						}`
				rp, err := newPPLResponseParserForTest(targets, response)
				assert.NoError(t, err)
				_, err = rp.parseTimeSeries()
				assert.Error(t, err)
			})
		})

		t.Run("Parses error response", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
							"timeField": "@timestamp"
						}`,
			}
			response := `{
						"error": {
							"reason": "Error occurred in Elasticsearch engine: no such index [unknown]",
							"details": "org.elasticsearch.index.IndexNotFoundException: no such index [unknown].",
							"type": "IndexNotFoundException"
						}
					}`
			rp, err := newPPLResponseParserForTest(targets, response)
			assert.NoError(t, err)
			queryRes, err := rp.parseTimeSeries()
			assert.NotNil(t, queryRes)
			assert.Equal(t, "Error occurred in Elasticsearch engine: no such index [unknown]", queryRes.Error.Error())
			assert.Len(t, queryRes.Frames, 1)
			assert.NoError(t, err)
		})

		t.Run("Query result frame meta field", func(t *testing.T) {
			t.Run("Should not be set on successful response", func(t *testing.T) {
				targets := map[string]string{
					"A": `{
								"timeField": "@timestamp"
							}`,
				}
				response := `{
							"schema": [
								{ "name": "valueField", "type": "integer" },
								{ "name": "timeName", "type": "timestamp" }
							],
							"datarows": [
								[20, "%s"]
							],
							"total": 1,
							"size": 1
						}`
				response = fmt.Sprintf(response, formatUnixMs(100, pplTSFormat))
				rp, err := newPPLResponseParserForTest(targets, response)
				assert.NoError(t, err)
				queryRes, err := rp.parseTimeSeries()
				assert.NoError(t, err)
				assert.NotNil(t, queryRes)
				assert.Len(t, queryRes.Frames, 1)
				frame := queryRes.Frames[0]
				assert.Nil(t, frame.Meta)
			})
			t.Run("Should be set on error response", func(t *testing.T) {
				targets := map[string]string{
					"A": `{
								"timeField": "@timestamp"
							}`,
				}
				response := `{
							"error": {
								"reason": "Error occurred in Elasticsearch engine: no such index [unknown]",
								"details": "org.elasticsearch.index.IndexNotFoundException: no such index [unknown].",
								"type": "IndexNotFoundException"
							}
						}`
				rp, err := newPPLResponseParserForTest(targets, response)
				assert.NoError(t, err)
				queryRes, err := rp.parseTimeSeries()
				assert.NoError(t, err)
				assert.NotNil(t, queryRes)
				assert.Len(t, queryRes.Frames, 1)
				frame := queryRes.Frames[0]
				assert.NotNil(t, frame.Meta)
			})
		})
	})
}

func newPPLResponseParserForTest(tsdbQueries map[string]string, responseBody string) (*pplResponseParser, error) {
	var response es.PPLResponse
	err := json.Unmarshal([]byte(responseBody), &response)
	if err != nil {
		return nil, err
	}

	response.DebugInfo = &es.PPLDebugInfo{
		Response: &es.PPLResponseInfo{
			Status: 200,
		},
	}

	return newPPLResponseParser(&response), nil
}

func formatUnixMs(ms int64, format string) string {
	return time.Unix(0, ms*int64(time.Millisecond)).UTC().Format(format)
}
