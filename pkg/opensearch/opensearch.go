package opensearch

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/grafana/opensearch-datasource/pkg/tsdb"
)

// OpenSearchExecutor represents a handler for handling OpenSearch datasource request
type OpenSearchExecutor struct{}

var (
	intervalCalculator tsdb.IntervalCalculator
)

type OpenSearchDatasource struct {
	HttpClient *http.Client
}

func NewOpenSearchDatasource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	log.DefaultLogger.Debug("Initializing new data source instance")

	httpClient, err := client.NewDatasourceHttpClient(ctx, &settings)
	if err != nil {
		return nil, err
	}

	return &OpenSearchDatasource{
		HttpClient: httpClient,
	}, nil
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (ds *OpenSearchDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	res := &backend.CheckHealthResult{}

	res.Status = backend.HealthStatusOk
	res.Message = "plugin is running"
	return res, nil
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (ds *OpenSearchDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if len(req.Queries) == 0 {
		return nil, fmt.Errorf("query contains no queries")
	}

	timeRange := req.Queries[0].TimeRange
	osClient, err := client.NewClient(ctx, req.PluginContext.DataSourceInstanceSettings, ds.HttpClient, &timeRange)
	if err != nil {
		return nil, err
	}

	//maybe do it here?
	var serviceMapQuery backend.DataQuery
	var nodeGraphIndex int
	for i, query := range req.Queries {
		model, _ := simplejson.NewJson(query.JSON)
		luceneQueryType := model.Get("luceneQueryType").MustString()
		nodeGraph := model.Get("nodeGraph").MustBool(false)
		if luceneQueryType == "Traces" && nodeGraph {
			nodeGraphIndex = i
			serviceMapQuery = createServiceMapQuery(query)
			break
		}
	}
	if serviceMapQuery.JSON != nil {
		query := newQueryRequest(osClient, []backend.DataQuery{serviceMapQuery}, req.PluginContext.DataSourceInstanceSettings, intervalCalculator)
		response, _ := wrapError(query.execute(ctx))
		services, operations := extractParametersFromServiceMapResponse(response)
		backend.Logger.Debug("ServiceMap query response", "response", response)
		model, _ := simplejson.NewJson(req.Queries[nodeGraphIndex].JSON)
		model.Set("services", services)
		model.Set("operations", operations)
		newJson, err := model.Encode()
		if err != nil {
			panic(err)
		}
		req.Queries[nodeGraphIndex].JSON = newJson
	}

	query := newQueryRequest(osClient, req.Queries, req.PluginContext.DataSourceInstanceSettings, intervalCalculator)
	response, err := wrapError(query.execute(ctx))

	return response, err
}
func createServiceMapQuery(q backend.DataQuery) backend.DataQuery {
	model, _ := simplejson.NewJson(q.JSON)
	model.Set("serviceMapOnly", true)
	b, _ := model.Encode()
	q.JSON = b
	return q
}
func extractParametersFromServiceMapResponse(resp *backend.QueryDataResponse) ([]string, []string) {
	services := make([]string, 0)
	operations := make([]string, 0)
	for _, response := range resp.Responses {
		for _, frame := range response.Frames {
			if frame.Name == "services" {
				field := frame.Fields[0]
				for i := 0; i < field.Len(); i++ {
					services = append(services, field.At(i).(string))
				}
			} else if frame.Name == "operations" {
				field := frame.Fields[0]
				for i := 0; i < field.Len(); i++ {
					operations = append(operations, field.At(i).(string))
				}
			}
		}
	}
	return services, operations
	//for _, response := range response.Responses {
	//	for _, frame := range response.Frames {
	//		if frame.Name ==
	//	}
	//}
}

func wrapError(response *backend.QueryDataResponse, err error) (*backend.QueryDataResponse, error) {
	var invalidQueryTypeError invalidQueryTypeError
	if errors.As(err, &invalidQueryTypeError) {
		return &backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				invalidQueryTypeError.refId: {
					Error: fmt.Errorf(`%w, expected Lucene or PPL`, err),
				}},
		}, nil
	}
	if err != nil {
		return response, fmt.Errorf("OpenSearch data source error: %w", err)
	}

	return response, err
}

func init() {
	intervalCalculator = tsdb.NewIntervalCalculator(nil)
}
