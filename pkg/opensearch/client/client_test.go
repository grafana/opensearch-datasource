package client

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	jsonEncoding "encoding/json"
	"encoding/pem"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
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
			buf, err := io.ReadAll(r.Body)
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

func Test_TLS_config_included_in_client_passed_from_decrypted_json_data(t *testing.T) {
	// generates a Certificate Authority certificate and self-signed certificate for the server, similar to https://opensearch.org/docs/latest/security/configuration/generate-certificates/
	ca, caPrivKey, caPEM, err := generateCaCertificate(t, "root.localhost")
	require.NoError(t, err)
	serverCertPEM, serverKeyPEM, err := generateCertificate(t, "server.localhost", ca, caPrivKey)
	require.NoError(t, err)
	serverCert, err := tls.X509KeyPair(serverCertPEM.Bytes(), serverKeyPEM.Bytes())
	require.NoError(t, err)
	// test server is started with client/server mutual TLS authentication
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {}))
	rootCaPool := x509.NewCertPool()
	rootCaPool.AppendCertsFromPEM(caPEM.Bytes())
	server.TLS = &tls.Config{
		ClientCAs:    rootCaPool,
		ClientAuth:   tls.RequireAndVerifyClientCert, // both client and server authenticate using their public/private key pair (mutual authentication)
		Certificates: []tls.Certificate{serverCert},
	}
	server.StartTLS()
	defer server.Close()

	// self-signed client certificate
	clientCertPEM, clientKeyPEM, err := generateCertificate(t, "client.localhost", ca, caPrivKey)
	require.NoError(t, err)

	// verify that newDatasourceHttpClient, when provided the client's JSON data from the config editor, is able to authenticate with the test server mutually
	client, err := newDatasourceHttpClient(&backend.DataSourceInstanceSettings{
		JSONData: jsonEncoding.RawMessage(`{"tlsAuth":true, "tlsAuthWithCACert":true}`),
		DecryptedSecureJSONData: map[string]string{
			"tlsCACert":     caPEM.String(),
			"tlsClientCert": clientCertPEM.String(),
			"tlsClientKey":  clientKeyPEM.String(),
		},
	})
	require.NoError(t, err)

	resp, err := client.Get(server.URL)
	assert.NoError(t, err)
	assert.Equal(t, 200, resp.StatusCode)
}

func generateCaCertificate(t *testing.T, commonName string) (*x509.Certificate, *rsa.PrivateKey, *bytes.Buffer, error) {
	t.Helper()
	ca := &x509.Certificate{
		SerialNumber: big.NewInt(2019),
		Subject: pkix.Name{
			CommonName:    commonName,
			Organization:  []string{"Grafana Labs"},
			Country:       []string{"France"},
			Province:      []string{""},
			Locality:      []string{"Paris"},
			StreetAddress: []string{"Golden Gate Bridge"},
			PostalCode:    []string{"75001"},
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().AddDate(1, 0, 0),
		IsCA:                  true,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
	}

	caPrivKey, err := rsa.GenerateKey(rand.Reader, 4096)
	if err != nil {
		return nil, nil, nil, err
	}

	caBytes, err := x509.CreateCertificate(rand.Reader, ca, ca, &caPrivKey.PublicKey, caPrivKey)
	if err != nil {
		return nil, nil, nil, err
	}

	caPEM := new(bytes.Buffer)
	if err := pem.Encode(caPEM, &pem.Block{
		Type:  "CERTIFICATE",
		Bytes: caBytes,
	}); err != nil {
		return nil, nil, nil, err
	}

	caPrivKeyPEM := new(bytes.Buffer)
	if err := pem.Encode(caPrivKeyPEM, &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(caPrivKey),
	}); err != nil {
		return nil, nil, nil, err
	}

	return ca, caPrivKey, caPEM, nil
}

func generateCertificate(t *testing.T, commonName string, ca *x509.Certificate, caPrivKey *rsa.PrivateKey) (*bytes.Buffer, *bytes.Buffer, error) {
	t.Helper()
	cert := &x509.Certificate{
		SerialNumber: big.NewInt(2019),
		Subject: pkix.Name{
			CommonName:   commonName,
			Organization: []string{"Grafana Labs"},
			Country:      []string{"France"},
			Locality:     []string{"Paris"},
			PostalCode:   []string{"75001"},
		},
		IPAddresses:  []net.IP{net.IPv4(127, 0, 0, 1), net.IPv6loopback},
		NotBefore:    time.Now(),
		NotAfter:     time.Now().AddDate(1, 0, 0),
		SubjectKeyId: []byte{1, 2, 3, 4, 6},
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
		KeyUsage:     x509.KeyUsageDigitalSignature,
	}

	certPrivKey, err := rsa.GenerateKey(rand.Reader, 4096)
	if err != nil {
		return nil, nil, err
	}

	certBytes, err := x509.CreateCertificate(rand.Reader, cert, ca, &certPrivKey.PublicKey, caPrivKey)
	if err != nil {
		return nil, nil, err
	}

	certPEM := new(bytes.Buffer)
	if err := pem.Encode(certPEM, &pem.Block{
		Type:  "CERTIFICATE",
		Bytes: certBytes,
	}); err != nil {
		return nil, nil, err
	}

	certPrivKeyPEM := new(bytes.Buffer)
	if err := pem.Encode(certPrivKeyPEM, &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(certPrivKey),
	}); err != nil {
		return nil, nil, err
	}

	return certPEM, certPrivKeyPEM, nil
}

func Test_newDatasourceHttpClient_includes_sigV4_information(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		// Elements of an AWS API request signature https://docs.aws.amazon.com/IAM/latest/UserGuide/signing-elements.html

		// Example `Authorization` header value:
		// Authorization: AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-date, Signature=fe5f80f77d5fa3beca038a248ff027d0445342fe2855ddc963176630326f1024 // cspell:disable-line
		// Assert that `Authorization` is present with a value
		authValues := r.Header.Values("Authorization")
		require.Len(t, authValues, 1)

		// Split `Authorization` header values based on `,`
		splitAuthValues := strings.Split(authValues[0], ",")
		require.Len(t, splitAuthValues, 3)

		// Assertions made on non-datetime-based parts of the values
		assert.True(t, strings.HasPrefix(splitAuthValues[0], "AWS4-HMAC-SHA256 Credential=some_access_key/"))
		assert.True(t, strings.HasSuffix(splitAuthValues[0], "/us-east-2/es/aws4_request"))
		assert.Equal(t, " SignedHeaders=host;x-amz-date", splitAuthValues[1])
		assert.True(t, strings.HasPrefix(splitAuthValues[2], " Signature="))

		xAmzDateValue := r.Header.Values("X-Amz-Date")
		assert.Len(t, xAmzDateValue, 1)
	}))
	defer server.Close()

	client, err := newDatasourceHttpClient(&backend.DataSourceInstanceSettings{
		JSONData: jsonEncoding.RawMessage(`{
		   "flavor":"opensearch",
		   "sigV4Auth":true,
		   "sigV4AuthType":"keys",
		   "sigV4Region":"us-east-2",
		   "timeField":"timestamp",
		   "version":"2.3.0"
		}`),
		DecryptedSecureJSONData: map[string]string{"sigV4AccessKey": "some_access_key", "sigV4SecretKey": "some_secret_key"},
	})
	require.NoError(t, err)

	_, err = client.Get(server.URL)
	assert.NoError(t, err)
}

func Test_newDatasourceHttpClient_sets_aoss_as_service_name_for_serverless(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		authValues := r.Header.Values("Authorization")
		require.Len(t, authValues, 1)
		splitAuthValues := strings.Split(authValues[0], ",")
		require.Len(t, splitAuthValues, 3)

		assert.True(t, strings.HasSuffix(splitAuthValues[0], "/aoss/aws4_request"))
	}))
	defer server.Close()

	client, err := newDatasourceHttpClient(&backend.DataSourceInstanceSettings{
		JSONData: jsonEncoding.RawMessage(`{
		   "flavor":"opensearch",
		   "sigV4Auth":true,
		   "serverless":true,
		   "sigV4AuthType":"keys",
		   "sigV4Region":"us-east-2",
		   "timeField":"timestamp",
		   "version":"2.3.0"
		}`),
		DecryptedSecureJSONData: map[string]string{"sigV4AccessKey": "some_access_key", "sigV4SecretKey": "some_secret_key"},
	})
	require.NoError(t, err)

	_, err = client.Get(server.URL)
	assert.NoError(t, err)
}
