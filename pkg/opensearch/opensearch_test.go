package opensearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
	ds := &OpenSearchDatasource{
		HttpClient: &http.Client{
			Transport: &mockTransport{},
		},
	}

	tests := []struct {
		name          string
		path          string
		expectError   bool
		expectedError string
	}{
		{
			name:        "Root _mapping is allowed",
			path:        "_mapping",
			expectError: false,
		},
		{
			name:        "Index _mapping is allowed",
			path:        "my_index/_mapping",
			expectError: false,
		},
		{
			name:        "Root _field_caps is allowed",
			path:        "_field_caps",
			expectError: false,
		},
		{
			name:        "Index _field_caps is allowed",
			path:        "my-index/_field_caps",
			expectError: false,
		},
		{
			name:        "Root _msearch is allowed",
			path:        "_msearch",
			expectError: false,
		},
		{
			name:          "Arbitrary path is disallowed",
			path:          "some/other/path",
			expectError:   true,
			expectedError: "invalid resource URL: some/other/path",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &backend.CallResourceRequest{
				Path: tt.path,
				PluginContext: backend.PluginContext{
					DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
						URL: "http://localhost:9200",
					},
				},
				Method: "GET",
			}
			sender := &mockCallResourceResponseSender{}

			err := ds.CallResource(context.Background(), req, sender)

			if tt.expectError {
				assert.Error(t, err)
				if err != nil {
					assert.Contains(t, err.Error(), tt.expectedError)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
