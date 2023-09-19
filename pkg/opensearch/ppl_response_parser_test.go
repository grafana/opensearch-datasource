package opensearch

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	es "github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/stretchr/testify/assert"

	. "github.com/smartystreets/goconvey/convey"
)

func TestPPLResponseParser(t *testing.T) {
	Convey("PPL response parser test", t, func() {
		Convey("Simple time series query", func() {
			Convey("Time field as first field", func() {
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
				So(err, ShouldBeNil)
				queryRes, err := rp.parseResponse(es.ConfiguredFields{}, "")
				So(err, ShouldBeNil)
				So(queryRes, ShouldNotBeNil)
				So(queryRes.Frames, ShouldHaveLength, 1)
				frame := queryRes.Frames[0]
				So(frame.Name, ShouldEqual, "testMetric")
				So(frame.Rows(), ShouldEqual, 2)
				So(floatAt(frame, 0, 0), ShouldEqual, 100)
				So(floatAt(frame, 0, 1), ShouldEqual, 200)
				So(floatAt(frame, 1, 0), ShouldEqual, 10)
				So(floatAt(frame, 1, 1), ShouldEqual, 15)
			})

			Convey("Time field as second field", func() {
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
				So(err, ShouldBeNil)
				queryRes, err := rp.parseResponse(es.ConfiguredFields{}, "")
				So(err, ShouldBeNil)
				So(queryRes, ShouldNotBeNil)
				So(queryRes.Frames, ShouldHaveLength, 1)
				frame := queryRes.Frames[0]
				So(frame.Name, ShouldEqual, "testMetric")
				So(frame.Rows(), ShouldEqual, 2)
				So(floatAt(frame, 0, 0), ShouldEqual, 100)
				So(floatAt(frame, 0, 1), ShouldEqual, 200)
				So(floatAt(frame, 1, 0), ShouldEqual, 20)
				So(floatAt(frame, 1, 1), ShouldEqual, 25)
			})
		})

		Convey("Set series name to be value field name", func() {
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
			So(err, ShouldBeNil)
			queryRes, err := rp.parseResponse(es.ConfiguredFields{}, "")
			So(err, ShouldBeNil)
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Frames, ShouldHaveLength, 1)
			frame := queryRes.Frames[0]
			So(frame.Name, ShouldEqual, "valueField")
		})

		Convey("Different date formats", func() {
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

			Convey("Timestamp time field type", func() {
				formattedResponse := fmt.Sprintf(response, "timestamp", formatUnixMs(100, pplTSFormat))
				rp, err := newPPLResponseParserForTest(targets, formattedResponse)
				So(err, ShouldBeNil)
				queryRes, err := rp.parseResponse(es.ConfiguredFields{}, "")
				So(err, ShouldBeNil)
				So(queryRes, ShouldNotBeNil)
				So(queryRes.Frames, ShouldHaveLength, 1)
				frame := queryRes.Frames[0]
				So(frame.Name, ShouldEqual, "testMetric")
				So(frame.Rows(), ShouldEqual, 1)
				So(floatAt(frame, 0, 0), ShouldEqual, 100)
				So(floatAt(frame, 1, 0), ShouldEqual, 10)
			})

			Convey("Datetime time field type", func() {
				formattedResponse := fmt.Sprintf(response, "datetime", formatUnixMs(100, pplTSFormat))
				rp, err := newPPLResponseParserForTest(targets, formattedResponse)
				So(err, ShouldBeNil)
				queryRes, err := rp.parseResponse(es.ConfiguredFields{}, "")
				So(err, ShouldBeNil)
				So(queryRes, ShouldNotBeNil)
				So(queryRes.Frames, ShouldHaveLength, 1)
				frame := queryRes.Frames[0]
				So(frame.Name, ShouldEqual, "testMetric")
				So(frame.Rows(), ShouldEqual, 1)
				So(floatAt(frame, 0, 0), ShouldEqual, 100)
				So(floatAt(frame, 1, 0), ShouldEqual, 10)
			})

			Convey("Date time field type", func() {
				formattedResponse := fmt.Sprintf(response, "date", formatUnixMs(0, pplDateFormat))
				rp, err := newPPLResponseParserForTest(targets, formattedResponse)
				So(err, ShouldBeNil)
				queryRes, err := rp.parseResponse(es.ConfiguredFields{}, "")
				So(err, ShouldBeNil)
				So(queryRes, ShouldNotBeNil)
				So(queryRes.Frames, ShouldHaveLength, 1)
				frame := queryRes.Frames[0]
				So(frame.Name, ShouldEqual, "testMetric")
				So(frame.Rows(), ShouldEqual, 1)
				So(floatAt(frame, 0, 0), ShouldEqual, 0)
				So(floatAt(frame, 1, 0), ShouldEqual, 10)
			})
		})

		Convey("Handle invalid schema for time series", func() {
			Convey("More than two fields", func() {
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
				So(err, ShouldBeNil)
				_, err = rp.parseResponse(es.ConfiguredFields{}, "")
				So(err, ShouldNotBeNil)
			})

			Convey("Less than two fields", func() {
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
				So(err, ShouldBeNil)
				_, err = rp.parseResponse(es.ConfiguredFields{}, "")
				So(err, ShouldNotBeNil)
			})

			Convey("No valid time field type", func() {
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
				So(err, ShouldBeNil)
				_, err = rp.parseResponse(es.ConfiguredFields{}, "")
				So(err, ShouldNotBeNil)
			})

			Convey("Valid time field type with invalid value type", func() {
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
				So(err, ShouldBeNil)
				_, err = rp.parseResponse(es.ConfiguredFields{}, "")
				So(err, ShouldNotBeNil)
			})

			Convey("Valid schema invalid time field type", func() {
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
				So(err, ShouldBeNil)
				_, err = rp.parseResponse(es.ConfiguredFields{}, "")
				So(err, ShouldNotBeNil)
			})

			Convey("Valid schema invalid time field value", func() {
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
				So(err, ShouldBeNil)
				_, err = rp.parseResponse(es.ConfiguredFields{}, "")
				So(err, ShouldNotBeNil)
			})
		})

		Convey("Parses error response", func() {
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
			So(err, ShouldBeNil)
			queryRes, err := rp.parseResponse(es.ConfiguredFields{}, "")
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Error.Error(), ShouldEqual, "Error occurred in Elasticsearch engine: no such index [unknown]")
			So(queryRes.Frames, ShouldHaveLength, 1)
			So(err, ShouldBeNil)
		})

		Convey("Query result frame meta field", func() {
			Convey("Should not be set on successful response", func() {
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
				So(err, ShouldBeNil)
				queryRes, err := rp.parseResponse(es.ConfiguredFields{}, "")
				So(err, ShouldBeNil)
				So(queryRes, ShouldNotBeNil)
				So(queryRes.Frames, ShouldHaveLength, 1)
				frame := queryRes.Frames[0]
				So(frame.Meta, ShouldBeNil)
			})
			Convey("Should be set on error response", func() {
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
				So(err, ShouldBeNil)
				queryRes, err := rp.parseResponse(es.ConfiguredFields{}, "")
				So(err, ShouldBeNil)
				So(queryRes, ShouldNotBeNil)
				So(queryRes.Frames, ShouldHaveLength, 1)
				frame := queryRes.Frames[0]
				So(frame.Meta, ShouldNotBeNil)
			})
		})
	})
}

func Test_parseResponse_should_return_error_from_ppl_response(t *testing.T) {
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
	queryRes, err := rp.parseResponse(es.ConfiguredFields{}, "")
	assert.NoError(t, err)
	assert.NotNil(t, queryRes)
	assert.Equal(t, 1, len(queryRes.Frames))
	assert.EqualError(t, queryRes.Error, "Error occurred in Elasticsearch engine: no such index [unknown]")
}

func Test_parseResponse_logs_format_query_should_return_data_frame_with_timefield_first_and_the_rest_of_the_fields_sorted_alphabetically(t *testing.T) {
	targets := map[string]string{
		"A": `{
					"format": "logs"
				}`,
	}
	response := `{
		"schema": [
			{ "name": "z", "type": "string" },
			{ "name": "a", "type": "string" },
			{ "name": "@timestamp", "type": "timestamp" }
		],
		"datarows": [
			["zzz", "aaa", "2023-09-01 00:00:00"]
		],
		"total": 1,
		"size": 1
	}`
	rp, err := newPPLResponseParserForTest(targets, response)
	assert.NoError(t, err)
	queryRes, err := rp.parseResponse(es.ConfiguredFields{
		TimeField: "@timestamp",
	}, logsType)
	assert.NoError(t, err)
	assert.Equal(t, 1, len(queryRes.Frames))
	assert.Equal(t, 3, len(queryRes.Frames[0].Fields))

	assert.Equal(t, "@timestamp", queryRes.Frames[0].Fields[0].Name)
	assert.Equal(t, "a", queryRes.Frames[0].Fields[1].Name)
	assert.Equal(t, "z", queryRes.Frames[0].Fields[2].Name)
}

func Test_parseResponse_logs_format_query_should_return_log_message_field_as_the_second_field_if_configured(t *testing.T) {
	targets := map[string]string{
		"A": `{
					"format": "logs"
				}`,
	}
	response := `{
		"schema": [
			{ "name": "@timestamp", "type": "timestamp" },
			{ "name": "message", "type": "string" },
			{ "name": "realMessageField", "type": "struct" }
		],
		"datarows": [
			["2023-09-01 00:00:00", "should not be treated as the message field", "the real message"]
		],
		"total": 1,
		"size": 1
	}`
	rp, err := newPPLResponseParserForTest(targets, response)
	assert.NoError(t, err)
	queryRes, err := rp.parseResponse(es.ConfiguredFields{
		TimeField:       "@timestamp",
		LogMessageField: "realMessageField",
	}, logsType)
	assert.NoError(t, err)
	assert.Equal(t, 1, len(queryRes.Frames))
	assert.Equal(t, 3, len(queryRes.Frames[0].Fields))

	actualRealMessage, _ := queryRes.Frames[0].Fields[1].ConcreteAt(0)
	assert.Equal(t, "realMessageField", queryRes.Frames[0].Fields[1].Name)
	assert.Equal(t, "the real message", actualRealMessage)
	actualMessage, _ := queryRes.Frames[0].Fields[2].ConcreteAt(0)
	assert.Equal(t, "message", queryRes.Frames[0].Fields[2].Name)
	assert.Equal(t, "should not be treated as the message field", actualMessage)
}

func Test_parseResponse_logs_format_query_should_flatten_nested_fields(t *testing.T) {
	targets := map[string]string{
		"A": `{
					"format": "logs"
				}`,
	}
	response := `{
		"schema": [
			{ "name": "@timestamp", "type": "timestamp" },
			{ "name": "geo", "type": "struct" }
		],
		"datarows": [
			["2023-09-01 00:00:00", {"src": "US", "dst": "CA"}]
		],
		"total": 1,
		"size": 1
	}`
	rp, err := newPPLResponseParserForTest(targets, response)
	assert.NoError(t, err)
	queryRes, err := rp.parseResponse(es.ConfiguredFields{
		TimeField: "@timestamp",
	}, logsType)
	assert.NoError(t, err)
	assert.Equal(t, 1, len(queryRes.Frames))
	assert.Equal(t, 3, len(queryRes.Frames[0].Fields))

	actualDst, _ := queryRes.Frames[0].Fields[1].ConcreteAt(0)
	assert.Equal(t, "geo.dst", queryRes.Frames[0].Fields[1].Name)
	assert.Equal(t, "CA", actualDst)
	actualSrc, _ := queryRes.Frames[0].Fields[2].ConcreteAt(0)
	assert.Equal(t, "geo.src", queryRes.Frames[0].Fields[2].Name)
	assert.Equal(t, "US", actualSrc)
}

func Test_parseResponse_logs_format_query_should_add_level_field_if_log_level_is_configured(t *testing.T) {
	targets := map[string]string{
		"A": `{
					"format": "logs"
				}`,
	}
	response := `{
		"schema": [
			{ "name": "@timestamp", "type": "timestamp" },
			{ "name": "loglevel", "type": "string" }
		],
		"datarows": [
			["2023-09-01 00:00:00", "success"]
		],
		"total": 1,
		"size": 1
	}`
	rp, err := newPPLResponseParserForTest(targets, response)
	assert.NoError(t, err)
	queryRes, err := rp.parseResponse(es.ConfiguredFields{
		TimeField:     "@timestamp",
		LogLevelField: "loglevel",
	}, logsType)
	assert.NoError(t, err)
	assert.Equal(t, 1, len(queryRes.Frames))
	assert.Equal(t, 3, len(queryRes.Frames[0].Fields))

	actualLevel, _ := queryRes.Frames[0].Fields[1].ConcreteAt(0)
	assert.Equal(t, "success", actualLevel)
	assert.Equal(t, "level", queryRes.Frames[0].Fields[1].Name)
}

func Test_parseResponse_logs_format_query_should_handle_different_date_and_time_formats(t *testing.T) {
	targets := map[string]string{
		"A": `{
					"format": "logs"
				}`,
	}
	response := `{
		"schema": [
			{ "name": "@timestamp", "type": "timestamp" },
			{ "name": "@datetime", "type": "datetime" },
			{ "name": "@date", "type": "date" },
			{ "name": "message", "type": "string" }
		],
		"datarows": [
			["2023-09-01 00:00:00", "2023-09-03 00:00:00", "2023-09-02", "foo"]
		],
		"total": 1,
		"size": 1
	}`
	rp, err := newPPLResponseParserForTest(targets, response)
	assert.NoError(t, err)
	queryRes, err := rp.parseResponse(es.ConfiguredFields{
		TimeField: "@timestamp",
	}, logsType)
	assert.NoError(t, err)
	assert.Equal(t, 1, len(queryRes.Frames))
	assert.Equal(t, 4, len(queryRes.Frames[0].Fields))

	expectedTimestamp, _ := time.Parse(pplTSFormat, "2023-09-01 00:00:00")
	actualTimestamp, _ := queryRes.Frames[0].Fields[0].ConcreteAt(0)
	assert.Equal(t, expectedTimestamp, actualTimestamp)
	assert.Equal(t, "@timestamp", queryRes.Frames[0].Fields[0].Name)

	expectedDate, _ := time.Parse(pplDateFormat, "2023-09-02")
	actualDate, _ := queryRes.Frames[0].Fields[1].ConcreteAt(0)
	assert.Equal(t, expectedDate, actualDate)
	assert.Equal(t, "@date", queryRes.Frames[0].Fields[1].Name)

	expectedDatetime, _ := time.Parse(pplTSFormat, "2023-09-03 00:00:00")
	actualDatetime, _ := queryRes.Frames[0].Fields[2].ConcreteAt(0)
	assert.Equal(t, expectedDatetime, actualDatetime)
	assert.Equal(t, "@datetime", queryRes.Frames[0].Fields[2].Name)
}

func Test_parseResponse_logs_format_query_should_set_preferred_visualization_to_logs(t *testing.T) {
	targets := map[string]string{
		"A": `{
					"format": "logs"
				}`,
	}
	response := `{
		"schema": [
			{ "name": "@timestamp", "type": "timestamp" },
			{ "name": "message", "type": "string" }
		],
		"datarows": [
			["2023-09-01 00:00:00", "foo"]
		],
		"total": 1,
		"size": 1
	}`
	rp, err := newPPLResponseParserForTest(targets, response)
	assert.NoError(t, err)
	queryRes, err := rp.parseResponse(es.ConfiguredFields{}, logsType)
	assert.NoError(t, err)
	assert.Equal(t, data.VisTypeLogs, string(queryRes.Frames[0].Meta.PreferredVisualization))
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

	var query Query
	err = json.Unmarshal([]byte(tsdbQueries["A"]), &query)
	if err != nil {
		return nil, err
	}

	return newPPLResponseParser(&response, &query), nil
}

func formatUnixMs(ms int64, format string) string {
	return time.Unix(0, ms*int64(time.Millisecond)).UTC().Format(format)
}

func floatAt(frame *data.Frame, fieldIdx, rowIdx int) float64 {
	result, _ := frame.FloatAt(fieldIdx, rowIdx)
	return result
}
