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

func Test_ppl_logs_request(t *testing.T) {
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/ppl_logs.query_input.json")
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
	expectedRequest :=
		`{"query":"source = opensearch_dashboards_sample_data_logs | where` + " `timestamp` " + `>= timestamp('2022-11-14 10:40:37') and` + " `timestamp` " + `<= timestamp('2022-11-14 10:43:45') | where geo.src = \"US\""}
`
	assert.Equal(t, expectedRequest, string(interceptedRequest))
}

func Test_ppl_logs_response(t *testing.T) {
	responseFromOpenSearch, err := os.ReadFile("testdata/ppl_logs.response_from_opensearch.json")
	require.NoError(t, err)
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/ppl_logs.query_input.json")
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
	experimental.CheckGoldenJSONResponse(t, "testdata", "ppl_logs.expected_result_generated_snapshot.golden", &responseForRefIdA, false)
}
