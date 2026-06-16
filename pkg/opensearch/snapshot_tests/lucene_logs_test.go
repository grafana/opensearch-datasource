package snapshot_tests

import (
	"context"
	"io"
	"net/http"
	"os"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/opensearch-datasource/pkg/opensearch"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_logs_request(t *testing.T) {
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_logs.query_input.json")
	require.NoError(t, err)
	var interceptedRequest []byte
	openSearchDatasource := opensearch.OpenSearchDatasource{
		HttpClient: &http.Client{
			// we don't assert the response in this test
			Transport: &queryDataTestRoundTripper{body: []byte(`{"responses":[]}`), statusCode: 200, requestCallback: func(req *http.Request) error {
				interceptedRequest, err = io.ReadAll(req.Body)
				if err != nil {
					return err
				}
				defer func() {
					if err := req.Body.Close(); err != nil {
						t.Errorf("failed to close request body: %v", err)
					}
				}()
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

	// assert request's header and query
	expectedRequest := `{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"}
{"aggs":{"1":{"date_histogram":{"field":"timestamp","interval":"100ms","min_doc_count":0,"extended_bounds":{"min":1668422437218,"max":1668422625668},"format":"epoch_millis"}}},"docvalue_fields":["timestamp"],"fields":[{"field":"timestamp","format":"strict_date_optional_time_nanos"}],"query":{"bool":{"filter":[{"range":{"timestamp":{"format":"epoch_millis","gte":1668422437218,"lte":1668422625668}}},{"query_string":{"analyze_wildcard":true,"query":"FlightDelayType:\"Carrier Delay\" AND Carrier:Open*"}}]}},"size":500,"sort":[{"timestamp":{"order":"desc","unmapped_type":"boolean"}}]}
`
	assert.Equal(t, expectedRequest, string(interceptedRequest))
}

func Test_logs_response(t *testing.T) {
	responseFromOpenSearch, err := os.ReadFile("testdata/lucene_logs.response_from_opensearch.json")
	require.NoError(t, err)
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_logs.query_input.json")
	require.NoError(t, err)
	openSearchDatasource := opensearch.OpenSearchDatasource{
		HttpClient: &http.Client{
			Transport: &queryDataTestRoundTripper{body: responseFromOpenSearch, statusCode: 200, requestCallback: func(req *http.Request) error { return nil }},
		},
	}

	result, err := openSearchDatasource.QueryData(context.Background(), &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{DataSourceInstanceSettings: newTestDsSettings()},
		Headers:       nil,
		Queries:       queries,
	})
	require.NoError(t, err)

	responseForRefIdA, ok := result.Responses["A"]
	assert.True(t, ok)
	experimental.CheckGoldenJSONResponse(t, "testdata", "lucene_logs.expected_result_generated_snapshot.golden", &responseForRefIdA, false)
}
