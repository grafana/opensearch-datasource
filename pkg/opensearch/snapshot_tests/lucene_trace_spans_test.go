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
{"query":{"bool":{"must":[{"range":{"startTime":{"gte":1668422437218,"lte":1668422625668}}},{"term":{"traceId":"test"}}]}},"size":1000}
`
	assert.Equal(t, expectedRequest, string(interceptedRequest))
}

func Test_trace_spans_request_with_multiple_spans_queries(t *testing.T) {
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_trace_spans.query_input_multiple.json")
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
{"query":{"bool":{"must":[{"range":{"startTime":{"gte":1668422437218,"lte":1668422625668}}},{"term":{"traceId":"test"}}]}},"size":1000}
{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"}
{"query":{"bool":{"must":[{"range":{"startTime":{"gte":1668422437218,"lte":1668422625668}}},{"term":{"traceId":"test123"}}]}},"size":1000}
`
	assert.Equal(t, expectedRequest, string(interceptedRequest))
}

func Test_trace_spans_request_with_trace_list_request(t *testing.T) {
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_trace_list_and_spans.query_input.json")
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
{"query":{"bool":{"must":[{"range":{"startTime":{"gte":1668422437218,"lte":1668422625668}}},{"term":{"traceId":"test"}}]}},"size":1000}
{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"}
{"aggs":{"traces":{"aggs":{"error_count":{"filter":{"term":{"traceGroupFields.statusCode":"2"}}},"last_updated":{"max":{"field":"traceGroupFields.endTime"}},"latency":{"max":{"script":{"source":"\n                if (doc.containsKey('traceGroupFields.durationInNanos') \u0026\u0026 !doc['traceGroupFields.durationInNanos'].empty) {\n                  return Math.round(doc['traceGroupFields.durationInNanos'].value / 10000) / 100.0\n                }\n                return 0\n                ","lang":"painless"}}},"trace_group":{"terms":{"field":"traceGroup","size":1}}},"terms":{"field":"traceId","size":1000,"order":{"_key":"asc"}}}},"query":{"bool":{"must":[{"range":{"startTime":{"gte":1668422437218,"lte":1668422625668}}},{"query_string":{"analyze_wildcard":true,"query":"some query"}}]}},"size":10}
`
	assert.Equal(t, expectedRequest, string(interceptedRequest))
}

// Couldn't get the snapshot test for the trace span responses to work because the response processing uses maps, so the result has slightly different order every time.
// Added a test for the response in response_processing.test.go instead
