package snapshot_tests

import (
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/opensearch-datasource/pkg/opensearch"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_service_map_prefetch_request(t *testing.T) {
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_service_map_prefetch_input.json")
	require.NoError(t, err)
	var interceptedRequests [][]byte
	openSearchDatasource := opensearch.OpenSearchDatasource{
		HttpClient: &http.Client{
			// we don't assert the response in this test
			Transport: &queryDataTestRoundTripper{body: []byte(`{"responses":[]}`), statusCode: 200, requestCallback: func(req *http.Request) error {
				request, err := io.ReadAll(req.Body)
				if err != nil {
					return err
				}
				interceptedRequests = append(interceptedRequests, request)
				
				defer req.Body.Close()
				return nil
			}},
		},
	}

	_, err = openSearchDatasource.QueryData(context.Background(), &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{DataSourceInstanceSettings: newTestDsSettings()},
		Headers:       nil,
		Queries:       queries,
	})
	require.NoError(t, err)

	assert.Len(t, interceptedRequests, 2)

	// assert request's header and query
	expectedRequest := `{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"}
{"aggs":{"service_name":{"aggs":{"destination_domain":{"aggs":{"destination_resource":{"terms":{"field":"destination.resource","size":500}}},"terms":{"field":"destination.domain","size":500}},"target_domain":{"aggs":{"target_resource":{"terms":{"field":"target.resource","size":500}}},"terms":{"field":"target.domain","size":500}}},"terms":{"field":"serviceName","size":500}}},"query":{"bool":{}},"size":0}
`
	assert.Equal(t, expectedRequest, string(interceptedRequests[0]))
}
