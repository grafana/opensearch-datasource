package opensearch

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"testing"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_wrapError(t *testing.T) {
	t.Run("wrapError intercepts an invalidQueryTypeError and returns a data response with a wrapped error", func(t *testing.T) {
		wrappedInvalidQueryTypeError := fmt.Errorf("%q is %w",
			"wrong queryType",
			invalidQueryTypeError{refId: "some ref id"})

		actualResponse, err := wrapError(nil, wrappedInvalidQueryTypeError)

		assert.NoError(t, err)
		assert.Equal(t, &backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"some ref id": {
					Error: fmt.Errorf(`%w, expected Lucene or PPL`, wrappedInvalidQueryTypeError)}},
		}, actualResponse)
	})

	t.Run("wrapError passes on any other type of error and states it's from OpenSearch data source", func(t *testing.T) {
		_, err := wrapError(&backend.QueryDataResponse{}, fmt.Errorf("some error"))

		assert.Error(t, err)
		assert.Equal(t, "OpenSearch data source error: some error", err.Error())
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

	testCases := []struct {
		name              string
		queries           []tsdbQuery
		response          *client.MultiSearchResponse
		shouldEditQuery   bool
		expectedQueryJson string
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
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			c := newFakeClient(client.OpenSearch, "2.3.0")
			c.multiSearchResponse = tc.response
			req := backend.QueryDataRequest{
				Queries: createDataQueriesForTests(tc.queries),
			}
			err := handleServiceMapPrefetch(context.Background(), c, &req)
			require.NoError(t, err)

			// handleServiceMapPrefetch may not put the operation in the same order every time
			model, err := simplejson.NewJson(req.Queries[0].JSON)
			require.NoError(t, err)

			ops := model.Get("operations").MustArray()
			var sortedOperations []string
			for _, op := range ops {
				sortedOperations = append(sortedOperations, op.(string))
			}
			slices.Sort(sortedOperations)
			model.Set("operations", sortedOperations)

			sortedQuery, err := model.Encode()
			require.NoError(t, err)

			if tc.shouldEditQuery {
				assert.Equal(t, []byte(tc.expectedQueryJson), sortedQuery)
			}
		})
	}
}
