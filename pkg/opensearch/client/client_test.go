package es

import (
	"bytes"
	"context"
	jsonEncoding "encoding/json"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/opensearch-datasource/pkg/tsdb"
	"github.com/grafana/opensearch-datasource/pkg/utils"
	"github.com/stretchr/testify/assert"
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
			JSONData: utils.NewRawJsonFromAny(map[string]interface{}{
				"version":                    "1.0.0",
				"maxConcurrentShardRequests": 6,
				"timeField":                  "@timestamp",
				"interval":                   "Daily",
				"database":                   "[metrics-]YYYY.MM.DD",
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

	Convey("Test HTTP custom headers", t, func() {
		httpClientScenario(t, "Given a fake http client", &backend.DataSourceInstanceSettings{
			JSONData: utils.NewRawJsonFromAny(map[string]interface{}{
				"version":         "1.0.0",
				"timeField":       "@timestamp",
				"interval":        "Daily",
				"httpHeaderName1": "X-Header-Name",
				"database":        "[metrics-]YYYY.MM.DD",
			}),
			DecryptedSecureJSONData: map[string]string{
				"httpHeaderValue1": "X-Header-Value",
			},
		}, func(sc *scenarioContext) {
			ppl, err := createPPLForTest(sc.client)
			So(err, ShouldBeNil)
			_, err = sc.client.ExecutePPLQuery(ppl)
			So(err, ShouldBeNil)

			Convey("Should send correct header", func() {
				So(sc.request.Header.Get("X-Header-Name"), ShouldEqual, "X-Header-Value")
			})
		})
	})

	Convey("Test PPL opensearch client", t, func() {
		httpClientScenario(t, "Given a fake http client and a v1.0.0 client with PPL response", &backend.DataSourceInstanceSettings{
			JSONData: utils.NewRawJsonFromAny(map[string]interface{}{
				"version":   "1.0.0",
				"timeField": "@timestamp",
				"interval":  "Daily",
				"database":  "[metrics-]YYYY.MM.DD",
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

func Test_client_returns_error_with_invalid_json_response(t *testing.T) {
	Convey("Test opensearch client", t, func() {
		httpClientScenario(t, "Given a valid payload with invalid json response", &backend.DataSourceInstanceSettings{
			JSONData: utils.NewRawJsonFromAny(map[string]interface{}{
				"version":                    "1.0.0",
				"maxConcurrentShardRequests": 6,
				"timeField":                  "@timestamp",
				"interval":                   "Daily",
				"database":                   "[metrics-]YYYY.MM.DD",
			}),
		}, func(sc *scenarioContext) {
			sc.responseBody = `Unauthorized`
			ms, err := createMultisearchForTest(sc.client)
			require.NoError(t, err)

			_, err = sc.client.ExecuteMultisearch(ms)

			assert.Error(t, err)
			assert.Equal(t, "error while Decoding to MultiSearchResponse: invalid character 'U' looking for beginning of value", err.Error())
		})
	})
}

func Test_TLS_config_included_in_client_when_configured_in_config_editor_settings(t *testing.T) {
	client, err := newDatasourceHttpClient(&backend.DataSourceInstanceSettings{
		JSONData: jsonEncoding.RawMessage(`{"tlsAuth":true, "tlsSkipVerify":true, "tlsAuthWithCACert":true}`),
		DecryptedSecureJSONData: map[string]string{
			"tlsCACert":     rootCA,
			"tlsClientCert": clientCert,
			"tlsClientKey":  clientKey,
		},
	})

	assert.NoError(t, err)
	transport, ok := client.Transport.(*http.Transport)
	require.True(t, ok)

	require.NotNil(t, transport.TLSClientConfig.Certificates)
	assert.Len(t, transport.TLSClientConfig.Certificates, 1)
	require.NotNil(t, transport.TLSClientConfig.RootCAs)
}

const rootCA = `-----BEGIN CERTIFICATE-----
MIID/jCCAuagAwIBAgIBATANBgkqhkiG9w0BAQsFADCBjzETMBEGCgmSJomT8ixk
ARkWA2NvbTEXMBUGCgmSJomT8ixkARkWB2V4YW1wbGUxGTAXBgNVBAoMEEV4YW1w
bGUgQ29tIEluYy4xITAfBgNVBAsMGEV4YW1wbGUgQ29tIEluYy4gUm9vdCBDQTEh
MB8GA1UEAwwYRXhhbXBsZSBDb20gSW5jLiBSb290IENBMB4XDTE4MDQyMjAzNDM0
NloXDTI4MDQxOTAzNDM0NlowgY8xEzARBgoJkiaJk/IsZAEZFgNjb20xFzAVBgoJ
kiaJk/IsZAEZFgdleGFtcGxlMRkwFwYDVQQKDBBFeGFtcGxlIENvbSBJbmMuMSEw
HwYDVQQLDBhFeGFtcGxlIENvbSBJbmMuIFJvb3QgQ0ExITAfBgNVBAMMGEV4YW1w
bGUgQ29tIEluYy4gUm9vdCBDQTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC
ggEBAK/u+GARP5innhpXK0c0q7s1Su1VTEaIgmZr8VWI6S8amf5cU3ktV7WT9SuV
TsAm2i2A5P+Ctw7iZkfnHWlsC3HhPUcd6mvzGZ4moxnamM7r+a9otRp3owYoGStX
ylVTQusAjbq9do8CMV4hcBTepCd+0w0v4h6UlXU8xjhj1xeUIz4DKbRgf36q0rv4
VIX46X72rMJSETKOSxuwLkov1ZOVbfSlPaygXIxqsHVlj1iMkYRbQmaTib6XWHKf
MibDaqDejOhukkCjzpptGZOPFQ8002UtTTNv1TiaKxkjMQJNwz6jfZ53ws3fh1I0
RWT6WfM4oeFRFnyFRmc4uYTUgAkCAwEAAaNjMGEwDwYDVR0TAQH/BAUwAwEB/zAf
BgNVHSMEGDAWgBSSNQzgDx4rRfZNOfN7X6LmEpdAczAdBgNVHQ4EFgQUkjUM4A8e
K0X2TTnze1+i5hKXQHMwDgYDVR0PAQH/BAQDAgGGMA0GCSqGSIb3DQEBCwUAA4IB
AQBoQHvwsR34hGO2m8qVR9nQ5Klo5HYPyd6ySKNcT36OZ4AQfaCGsk+SecTi35QF
RHL3g2qffED4tKR0RBNGQSgiLavmHGCh3YpDupKq2xhhEeS9oBmQzxanFwWFod4T
nnsG2cCejyR9WXoRzHisw0KJWeuNlwjUdJY0xnn16srm1zL/M/f0PvCyh9HU1mF1
ivnOSqbDD2Z7JSGyckgKad1Omsg/rr5XYtCeyJeXUPcmpeX6erWJJNTUh6yWC/hY
G/dFC4xrJhfXwz6Z0ytUygJO32bJG4Np2iGAwvvgI9EfxzEv/KP+FGrJOvQJAq4/
BU36ZAa80W/8TBnqZTkNnqZV
-----END CERTIFICATE-----`

const clientCert = `-----BEGIN CERTIFICATE-----
MIIEeDCCA2CgAwIBAgIGAWLrc1O3MA0GCSqGSIb3DQEBCwUAMIGPMRMwEQYKCZIm
iZPyLGQBGRYDY29tMRcwFQYKCZImiZPyLGQBGRYHZXhhbXBsZTEZMBcGA1UECgwQ
RXhhbXBsZSBDb20gSW5jLjEhMB8GA1UECwwYRXhhbXBsZSBDb20gSW5jLiBSb290
IENBMSEwHwYDVQQDDBhFeGFtcGxlIENvbSBJbmMuIFJvb3QgQ0EwHhcNMTgwNDIy
MDM0MzQ3WhcNMjgwNDE5MDM0MzQ3WjBOMQswCQYDVQQGEwJkZTENMAsGA1UEBwwE
dGVzdDEPMA0GA1UECgwGY2xpZW50MQ8wDQYDVQQLDAZjbGllbnQxDjAMBgNVBAMM
BXNwb2NrMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuZVv9feojW0W
x8ZLmf8FUMO8jsf9yZAc7ca77cQTgMGl4d9huMzaEgAaf+vuRMcOSd3aLJAhfTj/
4wUWRtdANh8DwHg+8VAQhUIGC4me0dKA2a+cNWW6Jxn1r5JDrqEpD+X5qVyRa6BU
Vkj7KDOzuWaw0glRyU1s6nrMrmsyuGQFvoUE7+9s7kaG/YYBuSNOc1MFQ5rXNYaz
Mbq+8EkSPGf6E5BT/fImso0acfj2m1C/gEQu2L1IvQb+6CZ2BsfzJS5mVGY7+Vqb
BDt3e3cvTzlUQPzAbuNsTN7t2dQDyTpI72E3CSZfJk33cfGZMpPxEO82TjO+s8a1
AEfRgjCmfQIDAQABo4IBGDCCARQwgbwGA1UdIwSBtDCBsYAUkjUM4A8eK0X2TTnz
e1+i5hKXQHOhgZWkgZIwgY8xEzARBgoJkiaJk/IsZAEZFgNjb20xFzAVBgoJkiaJ
k/IsZAEZFgdleGFtcGxlMRkwFwYDVQQKDBBFeGFtcGxlIENvbSBJbmMuMSEwHwYD
VQQLDBhFeGFtcGxlIENvbSBJbmMuIFJvb3QgQ0ExITAfBgNVBAMMGEV4YW1wbGUg
Q29tIEluYy4gUm9vdCBDQYIBATAdBgNVHQ4EFgQU8KRPXu4/Rfp2m+1lP/p76MSa
uBcwDAYDVR0TAQH/BAIwADAOBgNVHQ8BAf8EBAMCBeAwFgYDVR0lAQH/BAwwCgYI
KwYBBQUHAwIwDQYJKoZIhvcNAQELBQADggEBADv3pk3u1W1z2vQDcuIIUAapwNMj
3JF18uzq3eJjIsLcN32HS8IqMrC9pDgTnu4PnwnDMSD2c9YUbirsuBIAlTBuw79V
eFy/1YHL95RJQyYGaJI98ulKj6L39xwOValf4bbLcnjibMEE0F2w5Yo2QQkTx8Z3
i01uGssOp0sWZDWv9fdHExBGeT/Z/QJSNADyKqshJSOjmI3/WyxgSwsrTBhV9Gre
+PxxzQKwkadl5NGOjjI2N9RaerYLKsJ2GPOa124TnPFaJwRol+06O0OWQoYHxQXE
gd9YqEeT7WvuClgEqR+IDQt8PznXr/mUOTZt5lhSZ1iQOwx2Gj0hBtG7AmA=
-----END CERTIFICATE-----`

const clientKey = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC5lW/196iNbRbH
xkuZ/wVQw7yOx/3JkBztxrvtxBOAwaXh32G4zNoSABp/6+5Exw5J3doskCF9OP/j
BRZG10A2HwPAeD7xUBCFQgYLiZ7R0oDZr5w1ZbonGfWvkkOuoSkP5fmpXJFroFRW
SPsoM7O5ZrDSCVHJTWzqesyuazK4ZAW+hQTv72zuRob9hgG5I05zUwVDmtc1hrMx
ur7wSRI8Z/oTkFP98iayjRpx+PabUL+ARC7YvUi9Bv7oJnYGx/MlLmZUZjv5WpsE
O3d7dy9POVRA/MBu42xM3u3Z1APJOkjvYTcJJl8mTfdx8Zkyk/EQ7zZOM76zxrUA
R9GCMKZ9AgMBAAECggEAJ1BSI7nHZdBYfVETRmfo/Rs9+ERDDb4+9pr9SCjbldDP
/nmnFrIktx/4/STieITvkLPT6lFNGt0mjfXPqomiU2S+E3mVoeKbYVNjevG4KIxO
me7S6Vfnt61O59bVCisfSvwlp5xRvQo9m3rB49oSBmJL7m6lef6yJjkF36QbXkaL
dui9oYPt1MX8HHYPSYUBSbKXo4H6ihV1g43UwavYjQd6ls3799/tpzEl6r+uSQj9
9Fw6unsmOeJ7PJ3jGs3RUyMouYXgDK98a/iRGdC4wEs/ZMeTKkNh1sod5dzcAiHH
WTJq7+6Ye3StP8UD8IytFSsTYQaqV6Yt4pQc2GfsaQKBgQDrXmROf9hJQrDsReFa
0jdAMEmcYuDWENgjf2yxPBFiWqtmAiuMt5ux1wBldL179y5nWPlXbHZhIMq4Oe46
XWgkJxIwCHOKWxv/N/naQgkqe8Sfoc4B1Iygc62qPB5Njzr912oOANxk5nGbp/tV
k7lCo5PnX08hM2XbiFFQEKWBNQKBgQDJ2eJxF2jAL3xFSJoff9qS8twGHmQC1FA7
eVINxLprPQ2ThfsHDOHXDN6lPAtuA+1B27b4EPGfdee4NxuF9vD+fSwh7Ul948Bl
xV6O51TK20iRMvUMZJGR/Js1l9wYkt7KHB+PCH2/e1uCRLyFil2mZSE2v3dB93gm
2YpEau7BKQKBgAxcjsQYrtFaMVSXbviIJeK3JoaSIuDbTZ6/qIO+deNGg839uy/O
zNyQQDMT6IfEOamv4JiY17bONBds43gpQ7jyXGAtcXQIyPWkiPjPkw+qJG+F3f32
ndQnfy17rtO//Acs8yL9JJYgDENylR6vfYFkefYi6VMDEgxvomWkGi0pAoGAVJ/4
g5lg3VILM7DgjNw5cupGvHn5TAZfLNAMSqFz1oneKz88oxQPiu1mWrf1wsX6rmXD
K/VOl6AC6gSQkXWaS9eGrSKicRkPDJvWrOrnbbTJk7ZdbjirnxzcpXdpWxQYO3vW
70yMC79X+iF/OC1uXdiAOEfFY+6wfPkvMsfyGSECgYBCMLYoa0uoEaSjSW8suXZI
d1dT553W0VzMfh6bjxXjdnVfJtcZofwQpD+hs2TrzkF2F0avy8xqONWnUtRPBJjg
gFSPqWYOi03wJBUNE0orvDWf6I9k734dGg18Ay3L+z3qBZDZQFcmnEkzgMKqsQI5
aAFN2CEpQmttUp5FpZQtlg==
-----END PRIVATE KEY-----`
