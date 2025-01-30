package snapshot_tests

import (
	"context"
	"io"
	"net/http"
	"os"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/opensearch-datasource/pkg/opensearch"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_service_map_prefetch_request(t *testing.T) {
	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_service_map_input_trace_list.json")
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
{"aggs":{"service_name":{"aggs":{"destination_domain":{"aggs":{"destination_resource":{"terms":{"field":"destination.resource","size":1000}}},"terms":{"field":"destination.domain","size":1000}},"target_domain":{"aggs":{"target_resource":{"terms":{"field":"target.resource","size":1000}}},"terms":{"field":"target.domain","size":1000}}},"terms":{"field":"serviceName","size":1000}}},"query":{"bool":{}},"size":0}
`
	assert.Equal(t, expectedRequest, string(interceptedRequests[0]))
}

func Test_service_map__for_trace_list_request(t *testing.T) {
	responseFromServiceMapPrefetch, err := os.ReadFile("testdata/lucene_service_map_prefetch.response_from_opensearch.json")
	require.NoError(t, err)

	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_service_map_input_trace_list.json")
	require.NoError(t, err)
	var interceptedRequests [][]byte
	openSearchDatasource := opensearch.OpenSearchDatasource{
		HttpClient: &http.Client{
			// we don't assert the response in this test
			Transport: &queryDataTestRoundTripper{body: responseFromServiceMapPrefetch, statusCode: 200, requestCallback: func(req *http.Request) error {
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
	expectedRequestPrefetch := `{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"}
{"aggs":{"service_name":{"aggs":{"destination_domain":{"aggs":{"destination_resource":{"terms":{"field":"destination.resource","size":1000}}},"terms":{"field":"destination.domain","size":1000}},"target_domain":{"aggs":{"target_resource":{"terms":{"field":"target.resource","size":1000}}},"terms":{"field":"target.domain","size":1000}}},"terms":{"field":"serviceName","size":1000}}},"query":{"bool":{}},"size":0}
`
	expectedRequestMain := `{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"}
{"aggs":{"service_name":{"aggs":{"avg_latency_nanos":{"avg":{"field":"durationInNanos"}},"error_count":{"filter":{"term":{"status.code":"2"}}},"error_rate":{"bucket_script":{"buckets_path":{"errors":"error_count._count","total":"_count"},"script":"params.errors / params.total"}}},"terms":{"field":"serviceName","size":1000}}},"query":{"bool":{"filter":[{"terms":{"serviceName":["customer","driver","frontend","mysql","redis","route"]}},{"bool":{"should":[{"bool":{"filter":[{"bool":{"must_not":{"term":{"parentSpanId":{"value":""}}}}},{"terms":{"name":["/driver.DriverService/FindNearest","HTTP GET /customer","HTTP GET /route","driver"]}}]}},{"bool":{"must":{"term":{"parentSpanId":{"value":""}}}}}]}}],"must":{"range":{"startTime":{"gte":1668422437218,"lte":1668422625668}}}}},"size":1000}
{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"}
{"aggs":{"service_name":{"aggs":{"destination_domain":{"aggs":{"destination_resource":{"terms":{"field":"destination.resource","size":1000}}},"terms":{"field":"destination.domain","size":1000}},"target_domain":{"aggs":{"target_resource":{"terms":{"field":"target.resource","size":1000}}},"terms":{"field":"target.domain","size":1000}}},"terms":{"field":"serviceName","size":1000}}},"query":{"bool":{}},"size":0}
{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"}
{"aggs":{"traces":{"aggs":{"error_count":{"filter":{"term":{"traceGroupFields.statusCode":"2"}}},"last_updated":{"max":{"field":"traceGroupFields.endTime"}},"latency":{"max":{"script":{"source":"\n                if (doc.containsKey('traceGroupFields.durationInNanos') \u0026\u0026 !doc['traceGroupFields.durationInNanos'].empty) {\n                  return Math.round(doc['traceGroupFields.durationInNanos'].value / 10000) / 100.0\n                }\n                return 0\n                ","lang":"painless"}}},"trace_group":{"terms":{"field":"traceGroup","size":1}}},"terms":{"field":"traceId","size":1000,"order":{"_key":"asc"}}}},"query":{"bool":{"must":[{"range":{"startTime":{"gte":1668422437218,"lte":1668422625668}}},{"query_string":{"analyze_wildcard":true,"query":"*"}}]}},"size":10}
`
	assert.Equal(t, expectedRequestPrefetch, string(interceptedRequests[0]))
	assert.Equal(t, expectedRequestMain, string(interceptedRequests[1]))
}
func Test_service_map_for_single_trace_request(t *testing.T) {
	responseFromServiceMapPrefetch, err := os.ReadFile("testdata/lucene_service_map_prefetch.response_from_opensearch.json")
	require.NoError(t, err)

	queries, err := setUpDataQueriesFromFileWithFixedTimeRange(t, "testdata/lucene_service_map_input_with_trace_id.json")
	require.NoError(t, err)
	var interceptedRequests [][]byte
	openSearchDatasource := opensearch.OpenSearchDatasource{
		HttpClient: &http.Client{
			// we don't assert the response in this test
			Transport: &queryDataTestRoundTripper{body: responseFromServiceMapPrefetch, statusCode: 200, requestCallback: func(req *http.Request) error {
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
	expectedRequestPrefetch := `{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"}
{"aggs":{"service_name":{"aggs":{"destination_domain":{"aggs":{"destination_resource":{"terms":{"field":"destination.resource","size":1000}}},"terms":{"field":"destination.domain","size":1000}},"target_domain":{"aggs":{"target_resource":{"terms":{"field":"target.resource","size":1000}}},"terms":{"field":"target.domain","size":1000}}},"terms":{"field":"serviceName","size":1000}}},"query":{"bool":{}},"size":0}
`
	expectedRequestMain := `{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"}
{"aggs":{"service_name":{"aggs":{"avg_latency_nanos":{"avg":{"field":"durationInNanos"}},"error_count":{"filter":{"term":{"status.code":"2"}}},"error_rate":{"bucket_script":{"buckets_path":{"errors":"error_count._count","total":"_count"},"script":"params.errors / params.total"}}},"terms":{"field":"serviceName","size":1000}}},"query":{"bool":{"filter":[{"terms":{"serviceName":["customer","driver","frontend","mysql","redis","route"]}},{"term":{"traceId":{"value":"some-trace-id"}}},{"bool":{"should":[{"bool":{"filter":[{"bool":{"must_not":{"term":{"parentSpanId":{"value":""}}}}},{"terms":{"name":["/driver.DriverService/FindNearest","HTTP GET /customer","HTTP GET /route","driver"]}}]}},{"bool":{"must":{"term":{"parentSpanId":{"value":""}}}}}]}}],"must":{"range":{"startTime":{"gte":1668422437218,"lte":1668422625668}}}}},"size":1000}
{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"}
{"aggs":{"service_name":{"aggs":{"destination_domain":{"aggs":{"destination_resource":{"terms":{"field":"destination.resource","size":1000}}},"terms":{"field":"destination.domain","size":1000}},"target_domain":{"aggs":{"target_resource":{"terms":{"field":"target.resource","size":1000}}},"terms":{"field":"target.domain","size":1000}}},"terms":{"field":"serviceName","size":1000}}},"query":{"bool":{}},"size":0}
{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"}
{"query":{"bool":{"must":[{"range":{"startTime":{"gte":1668422437218,"lte":1668422625668}}},{"term":{"traceId":"some-trace-id"}}]}},"size":1000}
`
	assert.Equal(t, expectedRequestPrefetch, string(interceptedRequests[0]))
	assert.Equal(t, expectedRequestMain, string(interceptedRequests[1]))
}
