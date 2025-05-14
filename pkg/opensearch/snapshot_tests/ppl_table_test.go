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

func Test_ppl_table_request(t *testing.T) {
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/ppl_table.query_input.json")
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
		`{"query":"search source=opensearch_dashboards_sample_data_flights | where` + " `timestamp` " + `>= '2022-11-14 10:40:37' and` + " `timestamp` " + `<= '2022-11-14 10:43:45' | where AvgTicketPrice > 1150 | where FlightDelay = true "}
`
	assert.Equal(t, expectedRequest, string(interceptedRequest))
}

func Test_ppl_table_response(t *testing.T) {
	responseFromOpenSearch, err := os.ReadFile("testdata/ppl_table.response_from_opensearch.json")
	require.NoError(t, err)
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/ppl_table.query_input.json")
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
	experimental.CheckGoldenJSONResponse(t, "testdata", "ppl_table.expected_result_generated_snapshot.golden", &responseForRefIdA, false)
}
