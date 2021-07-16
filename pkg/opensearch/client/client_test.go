package es

import (
	"bytes"
	"context"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/opensearch-datasource/pkg/tsdb"
	"github.com/grafana/opensearch-datasource/pkg/utils"
	"github.com/stretchr/testify/require"

	. "github.com/smartystreets/goconvey/convey"
)

//nolint:goconst
func TestClient(t *testing.T) {
	Convey("Test opensearch client", t, func() {
		Convey("NewClient", func() {
			Convey("When no version set should return error", func() {
				ds := &backend.DataSourceInstanceSettings{
					JSONData: utils.NewRawJsonFromAny(make(map[string]interface{})),
				}

				_, err := NewClient(context.Background(), ds, nil)
				So(err, ShouldNotBeNil)
			})

			Convey("When no time field name set should return error", func() {
				ds := &backend.DataSourceInstanceSettings{
					JSONData: utils.NewRawJsonFromAny(map[string]interface{}{
						"version": "1.0.0",
					}),
				}

				_, err := NewClient(context.Background(), ds, nil)
				So(err, ShouldNotBeNil)
			})

			Convey("When unsupported version set should return error", func() {
				ds := &backend.DataSourceInstanceSettings{
					JSONData: utils.NewRawJsonFromAny(map[string]interface{}{
						"version":   1,
						"timeField": "@timestamp",
					}),
				}

				_, err := NewClient(context.Background(), ds, nil)
				So(err, ShouldNotBeNil)
			})
		})

		httpClientScenario(t, "Given a fake http client and a v1.0.0 client with response", &backend.DataSourceInstanceSettings{
			Database: "[metrics-]YYYY.MM.DD",
			JSONData: utils.NewRawJsonFromAny(map[string]interface{}{
				"version":                    "1.0.0",
				"maxConcurrentShardRequests": 6,
				"timeField":                  "@timestamp",
				"interval":                   "Daily",
			}),
		}, func(sc *scenarioContext) {
			sc.responseBody = `{
				"responses": [
					{
						"hits": {	"hits": [], "max_score": 0,	"total": { "value": 4656, "relation": "eq"}	},
						"status": 200
					}
				]
			}`

			Convey("When executing multi search", func() {
				ms, err := createMultisearchForTest(sc.client)
				So(err, ShouldBeNil)
				res, err := sc.client.ExecuteMultisearch(ms)
				So(err, ShouldBeNil)

				Convey("Should send correct request and payload", func() {
					So(sc.request, ShouldNotBeNil)
					So(sc.request.Method, ShouldEqual, http.MethodPost)
					So(sc.request.URL.Path, ShouldEqual, "/_msearch")
					So(sc.request.URL.RawQuery, ShouldEqual, "max_concurrent_shard_requests=6")

					So(sc.requestBody, ShouldNotBeNil)

					headerBytes, err := sc.requestBody.ReadBytes('\n')
					So(err, ShouldBeNil)
					bodyBytes := sc.requestBody.Bytes()

					jHeader, err := simplejson.NewJson(headerBytes)
					So(err, ShouldBeNil)

					jBody, err := simplejson.NewJson(bodyBytes)
					So(err, ShouldBeNil)

					So(jHeader.Get("index").MustString(), ShouldEqual, "metrics-2018.05.15")
					So(jHeader.Get("ignore_unavailable").MustBool(false), ShouldEqual, true)
					So(jHeader.Get("search_type").MustString(), ShouldEqual, "query_then_fetch")

					Convey("and replace $__interval variable", func() {
						So(jBody.GetPath("aggs", "2", "aggs", "1", "avg", "script").MustString(), ShouldEqual, "15000*@hostname")
					})

					Convey("and replace $__interval_ms variable", func() {
						So(jBody.GetPath("aggs", "2", "date_histogram", "interval").MustString(), ShouldEqual, "15s")
					})
				})

				Convey("Should parse response", func() {
					So(res.Status, ShouldEqual, 200)
					So(res.Responses, ShouldHaveLength, 1)
				})
			})
		})
	})

	Convey("Test PPL opensearch client", t, func() {
		httpClientScenario(t, "Given a fake http client and a v1.0.0 client with PPL response", &backend.DataSourceInstanceSettings{
			Database: "[metrics-]YYYY.MM.DD",
			JSONData: utils.NewRawJsonFromAny(map[string]interface{}{
				"version":   "1.0.0",
				"timeField": "@timestamp",
				"interval":  "Daily",
			}),
		}, func(sc *scenarioContext) {
			sc.responseBody = `{
				"schema": [{"name": "count(data)", "type": "string"}, {"name": "timestamp", "type": "timestamp"}],
				"datarows":  [
					["2020-12-01 00:39:02.912Z", "1"],
					["2020-12-01 03:26:21.326Z", "2"],
					["2020-12-01 03:34:43.399Z", "3"]
				]
			}`

			Convey("When executing PPL", func() {
				ppl, err := createPPLForTest(sc.client)
				So(err, ShouldBeNil)
				res, err := sc.client.ExecutePPLQuery(ppl)
				So(err, ShouldBeNil)

				Convey("Should send correct request and payload", func() {
					So(sc.request, ShouldNotBeNil)
					So(sc.request.Method, ShouldEqual, http.MethodPost)
					So(sc.request.URL.Path, ShouldEqual, "/_opendistro/_ppl")

					So(sc.requestBody, ShouldNotBeNil)

					bodyBytes := sc.requestBody.Bytes()

					jBody, err := simplejson.NewJson(bodyBytes)
					So(err, ShouldBeNil)

					Convey("and replace index pattern with wildcard", func() {
						So(jBody.Get("query").MustString(), ShouldEqual, "source = metrics-* | where `@timestamp` >= timestamp('$timeFrom') and `@timestamp` <= timestamp('$timeTo')")
					})
				})
				Convey("Should parse response", func() {
					So(res.Schema, ShouldHaveLength, 2)
					So(res.Datarows, ShouldHaveLength, 3)
					So(res.Status, ShouldEqual, 200)
				})
			})
		})
	})
}

func createMultisearchForTest(c Client) (*MultiSearchRequest, error) {
	msb := c.MultiSearch()
	s := msb.Search(tsdb.Interval{Value: 15 * time.Second, Text: "15s"})
	s.Agg().DateHistogram("2", "@timestamp", func(a *DateHistogramAgg, ab AggBuilder) {
		a.Interval = "$__interval"

		ab.Metric("1", "avg", "@hostname", func(a *MetricAggregation) {
			a.Settings["script"] = "$__interval_ms*@hostname"
		})
	})
	return msb.Build()
}

func createPPLForTest(c Client) (*PPLRequest, error) {
	b := c.PPL()
	b.AddPPLQueryString(c.GetTimeField(), "$timeTo", "$timeFrom", "")
	return b.Build()
}

type scenarioContext struct {
	client         Client
	request        *http.Request
	requestBody    *bytes.Buffer
	responseStatus int
	responseBody   string
}

type scenarioFunc func(*scenarioContext)

func httpClientScenario(t *testing.T, desc string, ds *backend.DataSourceInstanceSettings, fn scenarioFunc) {
	t.Helper()

	Convey(desc, func() {
		sc := &scenarioContext{
			responseStatus: 200,
			responseBody:   `{ "responses": [] }`,
		}
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			sc.request = r
			buf, err := ioutil.ReadAll(r.Body)
			require.Nil(t, err)

			sc.requestBody = bytes.NewBuffer(buf)

			rw.Header().Add("Content-Type", "application/json")
			_, err = rw.Write([]byte(sc.responseBody))
			require.Nil(t, err)
			rw.WriteHeader(sc.responseStatus)
		}))
		ds.URL = ts.URL

		from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
		to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
		timeRange := &backend.TimeRange{From: from, To: to}

		c, err := NewClient(context.Background(), ds, timeRange)
		So(err, ShouldBeNil)
		So(c, ShouldNotBeNil)
		sc.client = c

		currentNewDatasourceHttpClient := newDatasourceHttpClient

		newDatasourceHttpClient = func(ds *backend.DataSourceInstanceSettings) (*http.Client, error) {
			return ts.Client(), nil
		}

		defer func() {
			ts.Close()
			newDatasourceHttpClient = currentNewDatasourceHttpClient
		}()

		fn(sc)
	})
}
