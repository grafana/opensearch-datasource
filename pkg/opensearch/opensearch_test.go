package opensearch

import (
	"context"
	"encoding/json"
	"fmt"
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
