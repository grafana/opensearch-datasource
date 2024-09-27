package opensearch

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/errorsource"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
)

// OpenSearchExecutor represents a handler for handling OpenSearch datasource request
type OpenSearchExecutor struct{}

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

	response := handleServiceMapPrefetch(ctx, osClient, req)
	if response != nil {
		return response, nil
	}

	query := newQueryRequest(osClient, req.Queries, req.PluginContext.DataSourceInstanceSettings)
	response, err = wrapError(query.execute(ctx))
	return response, err
}

// handleServiceMapPrefetch inspects the given request, and, if it wants a serviceMap, creates and
// calls the Prefetch query to get the services and operations lists that are required for
// the associated Stats query. It then adds these parameters to the originating query so
// the Stats query can be created later. Returns a response with an error if the request fails.
func handleServiceMapPrefetch(ctx context.Context, osClient client.Client, req *backend.QueryDataRequest) *backend.QueryDataResponse {
	for i, query := range req.Queries {
		model, err := simplejson.NewJson(query.JSON)
		if err != nil {
			return wrapServiceMapPrefetchError(query.RefID, err)
		}
		queryType := model.Get("queryType").MustString()
		luceneQueryType := model.Get("luceneQueryType").MustString()
		serviceMapRequested := model.Get("serviceMap").MustBool(false)
		if queryType == Lucene && luceneQueryType == luceneQueryTypeTraces && serviceMapRequested {
			prefetchQuery := createServiceMapPrefetchQuery(query)
			q := newQueryRequest(osClient, []backend.DataQuery{prefetchQuery}, req.PluginContext.DataSourceInstanceSettings)
			response, err := q.execute(ctx)
			if err != nil {
				return wrapServiceMapPrefetchError(query.RefID, err)
			} else if response.Responses[query.RefID].Error != nil {
				return wrapServiceMapPrefetchError(query.RefID, response.Responses[query.RefID].Error)
			}
			services, operations := extractParametersFromServiceMapFrames(response)

			// encode the services and operations back to the JSON of the query to be used in the stats request
			model.Set("services", services)
			model.Set("operations", operations)
			newJson, err := model.Encode()
			// An error here _should_ be impossible but since services and operations are coming from outside,
			// handle it just in case
			if err != nil {
				return wrapServiceMapPrefetchError(query.RefID, err)
			}
			req.Queries[i].JSON = newJson
			return nil
		}
	}
	return nil
}

func wrapServiceMapPrefetchError(refId string, err error) *backend.QueryDataResponse {
	if err != nil {
		response := backend.NewQueryDataResponse()
		err = errorsource.PluginError(err, false) // keeps downstream source if present
		err = fmt.Errorf(`Error fetching service map info: %w`, err)
		return errorsource.AddErrorToResponse(refId, response, err)
	}
	return nil
}

func wrapError(response *backend.QueryDataResponse, err error) (*backend.QueryDataResponse, error) {
	if err != nil {
		return response, fmt.Errorf("OpenSearch data source error: %w", err)
	}
	return response, err
}

// createServiceMapPrefetchQuery returns a copy of the given query with the `serviceMapPrefetch`
// value set in its JSON. This is used to execute the Prefetch request.
func createServiceMapPrefetchQuery(q backend.DataQuery) backend.DataQuery {
	model, _ := simplejson.NewJson(q.JSON)
	// only request data from the service map index
	model.Set("serviceMapPrefetch", true)
	b, _ := model.Encode()
	q.JSON = b
	return q
}

// extractParametersFromServiceMapFrames extracts from the given response's dataframes the
// services and operations lists needed to create the Stats request. This is a somewhat dubious
// use of dataframes, but the underlying architecture left us with few options.
func extractParametersFromServiceMapFrames(resp *backend.QueryDataResponse) ([]string, []string) {
	services := make([]string, 0)
	operations := make([]string, 0)

	if resp == nil {
		return []string{}, []string{}
	}

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
}

func (ds *OpenSearchDatasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	// allowed paths for resource calls:
	// - empty string for fetching db version
	// - /_mapping for fetching index mapping, e.g. requests going to `index/_mapping`
	// - _msearch for executing getTerms queries
	// - _mapping for fetching "root" index mappings
	if req.Path != "" && !strings.HasSuffix(req.Path, "/_mapping") && req.Path != "_msearch" && req.Path != "_mapping" {
		return fmt.Errorf("invalid resource URL: %s", req.Path)
	}

	osUrl, err := createOpensearchURL(req, req.PluginContext.DataSourceInstanceSettings.URL)
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, req.Method, osUrl, bytes.NewBuffer(req.Body))
	if err != nil {
		return err
	}

	response, err := ds.HttpClient.Do(request)
	if err != nil {
		return err
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return err
	}

	responseHeaders := map[string][]string{
		"content-type": {"application/json"},
	}

	if encoding := response.Header.Get("Content-Encoding"); encoding != "" {
		responseHeaders["content-encoding"] = []string{response.Header.Get("Content-Encoding")}
	}

	return sender.Send(&backend.CallResourceResponse{
		Status:  response.StatusCode,
		Headers: responseHeaders,
		Body:    body,
	})
}

func createOpensearchURL(req *backend.CallResourceRequest, urlStr string) (string, error) {
	osUrl, err := url.Parse(urlStr)
	if err != nil {
		return "", fmt.Errorf("failed to parse data source URL: %s, error: %w", urlStr, err)
	}
	osUrl.Path = path.Join(osUrl.Path, req.Path)
	osUrlString := osUrl.String()
	// If the request path is empty and the URL does not end with a slash, add a slash to the URL.
	// This ensures that for version checks executed to the root URL, the URL ends with a slash.
	// This is helpful, for example, for load balancers that expect URLs to match the pattern /.*.
	if req.Path == "" && osUrlString[len(osUrlString)-1:] != "/" {
		return osUrl.String() + "/", nil
	}
	return osUrlString, nil
}
