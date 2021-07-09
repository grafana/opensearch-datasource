package elasticsearch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	es "github.com/grafana/open-distro-for-elasticsearch-grafana-datasource/pkg/elasticsearch/client"
	"github.com/grafana/open-distro-for-elasticsearch-grafana-datasource/pkg/tsdb"
)

// ElasticsearchExecutor represents a handler for handling elasticsearch datasource request
type ElasticsearchExecutor struct{}

var (
	intervalCalculator tsdb.IntervalCalculator
)

type TsdbQueryEndpoint interface {
	Query(ctx context.Context, ds *backend.DataSourceInstanceSettings, query *tsdb.TsdbQuery) (*tsdb.Response, error)
}

type ElasticsearchDatasource struct {
	im instancemgmt.InstanceManager
}

type ElasticsearchDatasourceInstance struct {
	dsInfo *backend.DataSourceInstanceSettings
}

func NewElasticsearchDatasource() *ElasticsearchDatasource {
	im := datasource.NewInstanceManager(newElasticsearchDatasourceInstance)
	return &ElasticsearchDatasource{
		im: im,
	}
}

func newElasticsearchDatasourceInstance(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	log.DefaultLogger.Debug("Initializing new data source instance")

	return &ElasticsearchDatasourceInstance{
		dsInfo: &settings,
	}, nil
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (ds *ElasticsearchDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	res := &backend.CheckHealthResult{}

	_, err := ds.im.Get(req.PluginContext)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = "Error getting datasource instance"
		log.DefaultLogger.Error("Error getting datasource instance", "err", err)
		return res, nil
	}

	res.Status = backend.HealthStatusOk
	res.Message = "plugin is running"
	return res, nil
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifer).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (ds *ElasticsearchDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	// qdr := backend.NewQueryDataResponse()

	_, err := ds.getDSInstance(req.PluginContext)
	if err != nil {
		return nil, err
	}

	if len(req.Queries) == 0 {
		return nil, fmt.Errorf("query contains no queries")
	}

	timeRange := req.Queries[0].TimeRange
	client, err := es.NewClient(ctx, req.PluginContext.DataSourceInstanceSettings, &timeRange)
	if err != nil {
		return nil, err
	}

	// if tsdbQuery.Debug {
	// 	client.EnableDebug()
	// }

	query := newTimeSeriesQuery(client, req, intervalCalculator)
	response, err := query.execute()
	return response, err
}

// getDSInstance Returns cached datasource or creates new one
func (ds *ElasticsearchDatasource) getDSInstance(pluginContext backend.PluginContext) (*ElasticsearchDatasourceInstance, error) {
	instance, err := ds.im.Get(pluginContext)
	if err != nil {
		return nil, err
	}
	return instance.(*ElasticsearchDatasourceInstance), nil
}

// NewElasticsearchExecutor creates a new elasticsearch executor
// func NewElasticsearchExecutor(dsInfo *backend.DataSourceInstanceSettings) (TsdbQueryEndpoint, error) {
// 	return &ElasticsearchExecutor{}, nil
// }

func init() {
	intervalCalculator = tsdb.NewIntervalCalculator(nil)
	// tsdb.RegisterTsdbQueryEndpoint("elasticsearch", NewElasticsearchExecutor)
}

// Query handles an elasticsearch datasource request
// func (e *ElasticsearchExecutor) Query(ctx context.Context, dsInfo *backend.DataSourceInstanceSettings, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
// 	if len(tsdbQuery.Queries) == 0 {
// 		return nil, fmt.Errorf("query contains no queries")
// 	}

// 	client, err := es.NewClient(ctx, dsInfo, tsdbQuery.TimeRange)
// 	if err != nil {
// 		return nil, err
// 	}

// 	if tsdbQuery.Debug {
// 		client.EnableDebug()
// 	}

// 	query := newTimeSeriesQuery(client, tsdbQuery, intervalCalculator)
// 	return query.execute()
// }
