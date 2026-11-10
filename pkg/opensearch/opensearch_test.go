package opensearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_wrapError(t *testing.T) {
	t.Run("wrapError passes on an error and states it's from OpenSearch data source", func(t *testing.T) {
		_, err := wrapError(&backend.QueryDataResponse{}, fmt.Errorf("some error"))

		assert.Error(t, err)
		assert.Equal(t, "OpenSearch data source error: some error", err.Error())
	})
}

func Test_wrapServiceMapPrefetchError(t *testing.T) {
	t.Run("wrapServiceMapPrefetchError wraps the error in a response", func(t *testing.T) {
		prefetchError := fmt.Errorf("Some prefetch error")
		actualResponse := wrapServiceMapPrefetchError("some ref id", prefetchError)

		assert.NotNil(t, actualResponse)
		assert.Equal(t, backend.ErrorSourcePlugin, actualResponse.Responses["some ref id"].ErrorSource)
		assert.Equal(t, fmt.Sprintf(`Error fetching service map info: %s`, prefetchError), actualResponse.Responses["some ref id"].Error.Error())
	})

	t.Run("wrapServiceMapPrefetchError returns nil if error is nil", func(t *testing.T) {
		response := wrapServiceMapPrefetchError("", nil)
		assert.Nil(t, response)
	})
}

func TestServiceMapPreFetch(t *testing.T) {
	buckets := `{
		"buckets": [
			{
				"key": "service1",
				"target_domain": {"buckets": [{"target_resource": {"buckets": [{"key": "op1"},{"key": "op2"}]}}]}
			},
			{
				"key": "service2",
				"target_domain":{"buckets": [{"target_resource": {"buckets": [{"key": "op2"},{"key": "op3"}]}}]}
			}
		]
	}`
	var unmarshaledBuckets interface{}
	err := json.Unmarshal([]byte(buckets), &unmarshaledBuckets)
	assert.NoError(t, err)

	responses := []*client.SearchResponse{
		{Aggregations: map[string]interface{}{
			"service_name": unmarshaledBuckets}},
	}

	errResponse := []*client.SearchResponse{
		{Error: map[string]interface{}{
			"reason": "foo",
		}},
	}

	testCases := []struct {
		name                string
		queries             []tsdbQuery
		response            *client.MultiSearchResponse
		expectedError       error
		expectedErrorSource backend.ErrorSource
		shouldEditQuery     bool
		expectedQueryJson   string
	}{
		{
			name: "no service map query",
			queries: []tsdbQuery{{
				refId: "A",
				body: `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "count", "id": "1" }, {"type": "avg", "field": "value", "id": "2" }],
		 			"bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "3" }]
				}`,
			}},
			shouldEditQuery: false,
		},
		{
			name: "correctly set services and operations",
			queries: []tsdbQuery{{
				refId: "A",
				body: `{
					"bucketAggs":[{ "field":"@timestamp", "id":"2", "settings":{"interval": "auto"}, "type": "date_histogram" }],
					"luceneQueryType": "Traces",
					"metrics": [{"id": "1", "type": "count" }],
					"query": "traceId:000000000000000011faa8ff95fa3eb8",
					"queryType": "lucene",
					"timeField": "@timestamp",
					"serviceMap": true
				}`,
			},
			},
			response: &client.MultiSearchResponse{
				Responses: responses,
			},
			expectedQueryJson: `{"bucketAggs":[{"field":"@timestamp","id":"2","settings":{"interval":"auto"},"type":"date_histogram"}],"luceneQueryType":"Traces","metrics":[{"id":"1","type":"count"}],"operations":["op1","op2","op3"],"query":"traceId:000000000000000011faa8ff95fa3eb8","queryType":"lucene","serviceMap":true,"services":["service1","service2"],"timeField":"@timestamp"}`,
			shouldEditQuery:   true,
		},
		{
			name: "Correctly fetch error",
			queries: []tsdbQuery{{
				refId: "A",
				body: `{
					"bucketAggs":[{ "field":"@timestamp", "id":"2", "settings":{"interval": "auto"}, "type": "date_histogram" }],
					"luceneQueryType": "Traces",
					"metrics": [{"id": "1", "type": "count" }],
					"query": "traceId:000000000000000011faa8ff95fa3eb8",
					"queryType": "lucene",
					"timeField": "@timestamp",
					"serviceMap": true
				}`,
			},
			},
			response: &client.MultiSearchResponse{
				Responses: errResponse,
			},
			expectedError:       fmt.Errorf("Error fetching service map info: foo"),
			expectedErrorSource: backend.ErrorSourceDownstream,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			c := newFakeClient(client.OpenSearch, "2.3.0")
			c.multiSearchResponse = tc.response
			req := backend.QueryDataRequest{
				Queries: createDataQueriesForTests(tc.queries),
			}
			response := handleServiceMapPrefetch(context.Background(), c, &req)
			if tc.expectedError != nil {
				require.NotNil(t, response)
				require.Equal(t, tc.expectedErrorSource, response.Responses["A"].ErrorSource)
				require.Equal(t, tc.expectedError.Error(), response.Responses["A"].Error.Error())
				return
			}

			require.Nil(t, response)
			if tc.shouldEditQuery {
				assert.Equal(t, tc.expectedQueryJson, string(req.Queries[0].JSON))
			}
		})
	}
}

type mockCallResourceResponseSender struct {
	Response *backend.CallResourceResponse
}

func (s *mockCallResourceResponseSender) Send(resp *backend.CallResourceResponse) error {
	s.Response = resp
	return nil
}

type mockTransport struct {
	RoundTripFunc func(req *http.Request) (*http.Response, error)
}

func (m *mockTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if m.RoundTripFunc != nil {
		return m.RoundTripFunc(req)
	}
	return &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(bytes.NewBufferString("{}")),
		Header:     make(http.Header),
	}, nil
}

func TestCallResource_Validation(t *testing.T) {
	// The path prefix shows that forwarded calls stay under the datasource URL.
	const dsURL = "http://localhost:9200/opensearch"

	tests := []struct {
		name   string
		method string
		path   string
		// wantURL is the URL forwarded to OpenSearch, empty when the call is rejected.
		wantURL string
	}{
		{"GET empty path (version check) is allowed", http.MethodGet, "", dsURL + "/"},
		{"GET root _mapping is allowed", http.MethodGet, "_mapping", dsURL + "/_mapping"},
		{"GET index _mapping is allowed", http.MethodGet, "my_index/_mapping", dsURL + "/my_index/_mapping"},
		{"GET root _field_caps is allowed", http.MethodGet, "_field_caps", dsURL + "/_field_caps?fields=*"},
		{"GET index _field_caps is allowed", http.MethodGet, "my-index/_field_caps", dsURL + "/my-index/_field_caps?fields=*"},
		{"POST root _msearch is allowed", http.MethodPost, "_msearch", dsURL + "/_msearch"},
		{"GET _cat/indices is allowed", http.MethodGet, "_cat/indices", dsURL + "/_cat/indices?format=json&h=index,status,health,docs.count"},

		{"Arbitrary path is disallowed", http.MethodGet, "some/other/path", ""},
		{"_cat/aliases is disallowed", http.MethodGet, "_cat/aliases", ""},
		{"PUT on index _mapping is disallowed", http.MethodPut, "my_index/_mapping", ""},
		{"GET on _msearch is disallowed", http.MethodGet, "_msearch", ""},
		{"parent segment escaping the URL prefix is disallowed", http.MethodGet, "../_mapping", ""},
		{"encoded traversal is disallowed", http.MethodGet, "my_index%2f..%2f_mapping", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var forwarded []string
			ds := &OpenSearchDatasource{
				HttpClient: &http.Client{
					Transport: &mockTransport{RoundTripFunc: func(req *http.Request) (*http.Response, error) {
						forwarded = append(forwarded, req.URL.String())
						return (&mockTransport{}).RoundTrip(req)
					}},
				},
			}
			req := &backend.CallResourceRequest{
				Path: tt.path,
				PluginContext: backend.PluginContext{
					DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
						URL: dsURL,
					},
				},
				Method: tt.method,
			}
			sender := &mockCallResourceResponseSender{}

			err := ds.CallResource(context.Background(), req, sender)
			require.NoError(t, err)
			require.NotNil(t, sender.Response)

			if tt.wantURL == "" {
				assert.Empty(t, forwarded)
				assert.Equal(t, http.StatusForbidden, sender.Response.Status)
				assert.Equal(t, []string{"application/json"}, sender.Response.Headers["content-type"])
				assert.JSONEq(t, `{"message":"the requested resource path is not supported by this datasource"}`, string(sender.Response.Body))
			} else {
				assert.Equal(t, []string{tt.wantURL}, forwarded)
				assert.Equal(t, http.StatusOK, sender.Response.Status)
			}
		})
	}
}

func TestIsCatIndices(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		expected bool
	}{
		{
			name:     "exact _cat/indices returns true",
			url:      "_cat/indices",
			expected: true,
		},
		{
			name:     "empty string returns false",
			url:      "",
			expected: false,
		},
		{
			name:     "_cat/aliases returns false",
			url:      "_cat/aliases",
			expected: false,
		},
		{
			name:     "prefix/_cat/indices returns false",
			url:      "prefix/_cat/indices",
			expected: false,
		},
		{
			name:     "_cat/indices/extra returns false",
			url:      "_cat/indices/extra",
			expected: false,
		},
		{
			name:     "_mapping returns false",
			url:      "_mapping",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isCatIndices(tt.url)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestCreateOpensearchURL_CatIndices(t *testing.T) {
	tests := []struct {
		name           string
		reqPath        string
		baseURL        string
		expectedSuffix string
	}{
		{
			name:           "_cat/indices gets correct query params",
			reqPath:        "_cat/indices",
			baseURL:        "http://localhost:9200",
			expectedSuffix: "format=json&h=index,status,health,docs.count",
		},
		{
			name:           "_field_caps gets fields=* query param",
			reqPath:        "_field_caps",
			baseURL:        "http://localhost:9200",
			expectedSuffix: "fields=*",
		},
		{
			name:           "_mapping gets no query params",
			reqPath:        "_mapping",
			baseURL:        "http://localhost:9200",
			expectedSuffix: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := createOpensearchURL(tt.reqPath, tt.baseURL)
			assert.NoError(t, err)
			if tt.expectedSuffix != "" {
				assert.Contains(t, result, tt.expectedSuffix)
			} else {
				// Ensure no query string is present (no '?' in URL)
				parsedURL, parseErr := url.Parse(result)
				assert.NoError(t, parseErr)
				assert.Empty(t, parsedURL.RawQuery)
			}
		})
	}
}

func TestCheckHealth(t *testing.T) {
	const healthy = `{"indices":["logs-2026.10.28"],"fields":{"@timestamp":{"date":{"type":"date"}}}}`
	tests := []struct {
		name        string
		index       string
		interval    string
		body        string
		status      int
		wantStatus  backend.HealthStatus
		wantMessage string
		retry       bool
	}{
		{name: "Serverless static index", index: "logs", body: healthy, wantMessage: "Index OK. Time field name OK."},
		{name: "wildcard index", index: "logs-*", body: healthy, wantMessage: "Index OK. Time field name OK."},
		{name: "index alias", index: "logs-current", body: healthy, wantMessage: "Index OK. Time field name OK."},
		{name: "no default index", body: `{"fields":{}}`, wantMessage: "Fields fetched OK. Index not set."},
		{name: "date nanos", index: "logs", body: `{"fields":{"@timestamp":{"date_nanos":{"type":"date_nanos"}}}}`, wantMessage: "Index OK. Time field name OK."},
		{name: "missing time field", index: "logs", body: `{"fields":{}}`, wantMessage: "Index OK. Note: No field named @timestamp found"},
		{name: "non-date time field", index: "logs", body: `{"fields":{"@timestamp":{"keyword":{"type":"keyword"}}}}`, wantMessage: "Index OK. Note: @timestamp is not a date field"},
		{name: "empty error body", index: "logs", status: http.StatusForbidden, wantStatus: backend.HealthStatusError, wantMessage: "OpenSearch health check failed: HTTP 403 Forbidden"},
		{name: "whitespace error body", index: "logs", status: http.StatusForbidden, body: " \n", wantStatus: backend.HealthStatusError, wantMessage: "OpenSearch health check failed: HTTP 403 Forbidden"},
		{name: "error body preserved", index: "logs", status: http.StatusNotFound, body: "index not found", wantStatus: backend.HealthStatusError, wantMessage: "index not found"},
		{name: "invalid JSON", index: "logs", body: "{", wantStatus: backend.HealthStatusError, wantMessage: "Error parsing response:"},
		{name: "retry generated indices", index: "[logs-]YYYY.MM.DD.HH", interval: "Hourly", body: healthy, retry: true, wantMessage: "Index OK. Time field name OK."},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			calls := 0
			var paths []string
			ds := &OpenSearchDatasource{HttpClient: &http.Client{Transport: &mockTransport{RoundTripFunc: func(req *http.Request) (*http.Response, error) {
				calls++
				paths = append(paths, req.URL.Path)
				assert.Equal(t, http.MethodGet, req.Method)
				assert.Equal(t, "*", req.URL.Query().Get("fields"))
				if tt.retry {
					assert.Contains(t, req.URL.Path, "/logs-")
					assert.Contains(t, req.URL.Path, "/_field_caps")
				} else {
					wantPath := "/_field_caps"
					if tt.index != "" {
						wantPath = "/" + tt.index + wantPath
					}
					assert.Equal(t, wantPath, req.URL.Path)
				}
				status, body := tt.status, tt.body
				if status == 0 {
					status = http.StatusOK
				}
				if tt.retry && calls == 1 {
					status, body = http.StatusNotFound, "index not found"
				}
				return &http.Response{StatusCode: status, Body: io.NopCloser(bytes.NewBufferString(body)), Header: make(http.Header)}, nil
			}}}}
			settings, err := json.Marshal(map[string]interface{}{
				"flavor": "opensearch", "version": "2.0.0", "serverless": true,
				"timeField": "@timestamp", "database": tt.index, "interval": tt.interval,
			})
			require.NoError(t, err)
			result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{URL: "https://example.com", JSONData: settings},
			}})
			require.NoError(t, err)
			wantStatus := tt.wantStatus
			if wantStatus == backend.HealthStatusUnknown {
				wantStatus = backend.HealthStatusOk
			}
			assert.Equal(t, wantStatus, result.Status)
			if tt.name == "invalid JSON" {
				assert.Contains(t, result.Message, tt.wantMessage)
			} else {
				assert.Equal(t, tt.wantMessage, result.Message)
			}
			if tt.retry {
				assert.Equal(t, 2, calls)
				require.Len(t, paths, 2)
				assert.NotEqual(t, paths[0], paths[1])
			} else {
				assert.Equal(t, 1, calls)
			}
		})
	}
}
