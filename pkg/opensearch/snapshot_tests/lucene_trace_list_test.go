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

func Test_trace_list_request(t *testing.T) {
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_trace_list.query_input.json")
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
{"aggs":{"traces":{"aggs":{"error_count":{"filter":{"term":{"traceGroupFields.statusCode":"2"}}},"last_updated":{"max":{"field":"traceGroupFields.endTime"}},"latency":{"max":{"script":{"source":"\n                if (doc.containsKey('traceGroupFields.durationInNanos') \u0026\u0026 !doc['traceGroupFields.durationInNanos'].empty) {\n                  return Math.round(doc['traceGroupFields.durationInNanos'].value / 10000) / 100.0\n                }\n                return 0\n                ","lang":"painless"}}},"trace_group":{"terms":{"field":"traceGroup","size":1}}},"terms":{"field":"traceId","size":100,"order":{"_key":"asc"}}}},"query":{"bool":{"must":[{"range":{"startTime":{"gte":1668422437218,"lte":1668422625668}}},{"query_string":{"analyze_wildcard":true,"query":"some query"}}]}},"size":10}
`
	assert.Equal(t, expectedRequest, string(interceptedRequest))
}

func Test_trace_list_request_with_multiple_list_queries(t *testing.T) {
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_trace_list.query_input_multiple.json")
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
{"aggs":{"traces":{"aggs":{"error_count":{"filter":{"term":{"traceGroupFields.statusCode":"2"}}},"last_updated":{"max":{"field":"traceGroupFields.endTime"}},"latency":{"max":{"script":{"source":"\n                if (doc.containsKey('traceGroupFields.durationInNanos') \u0026\u0026 !doc['traceGroupFields.durationInNanos'].empty) {\n                  return Math.round(doc['traceGroupFields.durationInNanos'].value / 10000) / 100.0\n                }\n                return 0\n                ","lang":"painless"}}},"trace_group":{"terms":{"field":"traceGroup","size":1}}},"terms":{"field":"traceId","size":100,"order":{"_key":"asc"}}}},"query":{"bool":{"must":[{"range":{"startTime":{"gte":1668422437218,"lte":1668422625668}}},{"query_string":{"analyze_wildcard":true,"query":"some query"}}]}},"size":10}
{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"}
{"aggs":{"traces":{"aggs":{"error_count":{"filter":{"term":{"traceGroupFields.statusCode":"2"}}},"last_updated":{"max":{"field":"traceGroupFields.endTime"}},"latency":{"max":{"script":{"source":"\n                if (doc.containsKey('traceGroupFields.durationInNanos') \u0026\u0026 !doc['traceGroupFields.durationInNanos'].empty) {\n                  return Math.round(doc['traceGroupFields.durationInNanos'].value / 10000) / 100.0\n                }\n                return 0\n                ","lang":"painless"}}},"trace_group":{"terms":{"field":"traceGroup","size":1}}},"terms":{"field":"traceId","size":100,"order":{"_key":"asc"}}}},"query":{"bool":{"must":[{"range":{"startTime":{"gte":1668422437218,"lte":1668422625668}}},{"query_string":{"analyze_wildcard":true,"query":"some query"}}]}},"size":10}
`
	assert.Equal(t, expectedRequest, string(interceptedRequest))
}

func Test_trace_list_response(t *testing.T) {
	responseFromOpenSearch, err := os.ReadFile("testdata/lucene_trace_list.response_from_opensearch.json")
	require.NoError(t, err)
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_trace_list.query_input.json")
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
	experimental.CheckGoldenJSONResponse(t, "testdata", "lucene_trace_list.expected_result_generated_snapshot.golden", &responseForRefIdA, false)
}

func Test_trace_list_response_with_multiple_list_queries(t *testing.T) {
	responseFromOpenSearch, err := os.ReadFile("testdata/lucene_trace_list.response_from_opensearch_multiple.json")
	require.NoError(t, err)
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_trace_list.query_input_multiple.json")
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
	responseForRefIdB, ok := result.Responses["B"]
	assert.True(t, ok)
	experimental.CheckGoldenJSONResponse(t, "testdata", "lucene_trace_list.expected_result_generated_snapshot.golden", &responseForRefIdA, false)
	experimental.CheckGoldenJSONResponse(t, "testdata", "lucene_trace_list.expected_result_generated_snapshot.golden", &responseForRefIdB, false)
}

