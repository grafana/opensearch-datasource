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

func Test_trace_spans_request(t *testing.T) {
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_trace_spans.query_input.json")
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
{"aggs":{"2":{"date_histogram":{"field":"@timestamp","interval":"100ms","min_doc_count":0,"extended_bounds":{"min":1668422437218,"max":1668422625668},"format":"epoch_millis"}}},"query":{"bool":{"must":[{"range":{"startTime":{"gte":1668422437218,"lte":1668422625668}}},{"term":{"traceId":"test"}}]}},"size":1000}
`
	assert.Equal(t, expectedRequest, string(interceptedRequest))
}
// Couldn't get the snapshot test for the trace span responses to work because the response processing uses maps, so the result has slightly different order every time. 
// Added a test for the response in response_processing.test.go instead
