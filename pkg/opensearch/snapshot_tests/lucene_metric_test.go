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

func Test_metric_max_request(t *testing.T) {
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_metric_max.query_input.json")
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
{"aggs":{"2":{"aggs":{"1":{"max":{"field":"AvgTicketPrice"}}},"terms":{"field":"AvgTicketPrice","size":10,"order":{"_key":"desc"},"min_doc_count":0}}},"query":{"bool":{"filter":[{"range":{"timestamp":{"format":"epoch_millis","gte":1668422437218,"lte":1668422625668}}},{"query_string":{"analyze_wildcard":true,"query":"*"}}]}},"size":0}
`
	assert.Equal(t, expectedRequest, string(interceptedRequest))
}

func Test_metric_max_response(t *testing.T) {
	responseFromOpenSearch, err := os.ReadFile("testdata/lucene_metric_max.response_from_opensearch.json")
	require.NoError(t, err)
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_metric_max.query_input.json")
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
	experimental.CheckGoldenJSONResponse(t, "testdata", "lucene_metric_max.expected_result_generated_snapshot.golden", &responseForRefIdA, false)
}

func Test_metric_sum_group_by_date_histogram_request(t *testing.T) {
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_metric_sum_group_by_date_histogram.query_input.json")
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
{"aggs":{"2":{"aggs":{"1":{"sum":{"field":"DistanceKilometers"}}},"date_histogram":{"field":"timestamp","interval":"100ms","min_doc_count":0,"extended_bounds":{"min":1668422437218,"max":1668422625668},"format":"epoch_millis"}}},"query":{"bool":{"filter":[{"range":{"timestamp":{"format":"epoch_millis","gte":1668422437218,"lte":1668422625668}}},{"query_string":{"analyze_wildcard":true,"query":"*"}}]}},"size":0}
`
	assert.Equal(t, expectedRequest, string(interceptedRequest))
}

func Test_metric_sum_group_by_date_histogram_response(t *testing.T) {
	responseFromOpenSearch, err := os.ReadFile("testdata/lucene_metric_sum_group_by_date_histogram.response_from_opensearch.json")
	require.NoError(t, err)
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_metric_sum_group_by_date_histogram.query_input.json")
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
	experimental.CheckGoldenJSONResponse(t, "testdata", "lucene_metric_sum_group_by_date_histogram.expected_result_generated_snapshot.golden", &responseForRefIdA, false)
}

func Test_metric_average_derivative_group_by_date_histogram_request(t *testing.T) {
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_metric_average_derivative_group_by_date_histogram.query_input.json")
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
{"aggs":{"2":{"aggs":{"1":{"avg":{"field":"AvgTicketPrice"}},"3":{"derivative":{"buckets_path":"1"}}},"date_histogram":{"field":"timestamp","interval":"1d","min_doc_count":0,"extended_bounds":{"min":1668422437218,"max":1668422625668},"format":"epoch_millis"}}},"query":{"bool":{"filter":[{"range":{"timestamp":{"format":"epoch_millis","gte":1668422437218,"lte":1668422625668}}},{"query_string":{"analyze_wildcard":true,"query":"*"}}]}},"size":0}
`
	assert.Equal(t, expectedRequest, string(interceptedRequest))
}

func Test_metric_average_derivative_group_by_date_histogram_response(t *testing.T) {
	responseFromOpenSearch, err := os.ReadFile("testdata/lucene_metric_average_derivative_group_by_date_histogram.response_from_opensearch.json")
	require.NoError(t, err)
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_metric_average_derivative_group_by_date_histogram.query_input.json")
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
	experimental.CheckGoldenJSONResponse(t, "testdata", "lucene_metric_average_derivative_group_by_date_histogram.expected_result_generated_snapshot.golden", &responseForRefIdA, false)
}
