package opensearch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	es "github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/grafana/opensearch-datasource/pkg/tsdb"
)

// OpenSearchExecutor represents a handler for handling OpenSearch datasource request
type OpenSearchExecutor struct{}

var (
	intervalCalculator tsdb.IntervalCalculator
)

type TsdbQueryEndpoint interface {
	Query(ctx context.Context, ds *backend.DataSourceInstanceSettings, query *tsdb.TsdbQuery) (*tsdb.Response, error)
}

type OpenSearchDatasource struct {
	dsInfo *backend.DataSourceInstanceSettings
}

func NewOpenSearchDatasource(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	log.DefaultLogger.Debug("Initializing new data source instance")

	return &OpenSearchDatasource{
		dsInfo: &settings,
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
	client, err := es.NewClient(ctx, req.PluginContext.DataSourceInstanceSettings, &timeRange)
	if err != nil {
		return nil, err
	}

	query := newTimeSeriesQuery(client, req, intervalCalculator)
	response, err := query.execute()
	return response, err
}

func init() {
	intervalCalculator = tsdb.NewIntervalCalculator(nil)
}
