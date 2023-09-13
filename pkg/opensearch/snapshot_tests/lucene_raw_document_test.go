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

func Test_raw_document_request(t *testing.T) {
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_raw_document.query_input.json")
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

	// assert request's header and query
	expectedRequest := `{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"}
{"fields":[{"field":"timestamp","format":"strict_date_optional_time_nanos"}],"query":{"bool":{"filter":[{"range":{"timestamp":{"format":"epoch_millis","gte":1668422437218,"lte":1668422625668}}},{"query_string":{"analyze_wildcard":true,"query":"FlightNum:*M"}}]}},"size":480,"sort":[{"timestamp":{"order":"asc","unmapped_type":"boolean"}},{"_doc":{"order":"asc"}}]}
`
	assert.Equal(t, expectedRequest, string(interceptedRequest))
}

func Test_raw_document_response(t *testing.T) {
	responseFromOpenSearch, err := os.ReadFile("testdata/lucene_raw_document.response_from_opensearch.json")
	require.NoError(t, err)
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_raw_document.query_input.json")
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
	experimental.CheckGoldenJSONResponse(t, "testdata", "lucene_raw_document.expected_result_generated_snapshot.golden", &responseForRefIdA, false)
}
