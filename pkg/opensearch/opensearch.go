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
	"time"

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

	jsonDataStr := req.PluginContext.DataSourceInstanceSettings.JSONData
	jsonData, err := simplejson.NewJson(jsonDataStr)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = "Failed to parse settings"
		return res, nil
	}

	flavor := jsonData.Get("flavor").MustString("")
	if flavor != string(client.OpenSearch) && flavor != string(client.Elasticsearch) {
		res.Status = backend.HealthStatusError
		res.Message = "No version set"
		return res, nil
	}

	_, err = client.ExtractVersion(jsonData.Get("version"))
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = "No version set"
		return res, nil
	}

	timeField, err := jsonData.Get("timeField").String()
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = fmt.Sprintf("time field name is required, err=%v", err)
		return res, nil
	}

	db := jsonData.Get("database").MustString()
	indexInterval := jsonData.Get("interval").MustString()

	ip, err := client.NewIndexPattern(indexInterval, db)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = fmt.Sprintf("Failed to generate index: %s", err)
		return res, nil
	}
	// Same as the frontend check, we generate the time pattern indices for the last six hours
	indices := ip.GetIndices(&backend.TimeRange{From: time.Now().Add(-6 * time.Hour), To: time.Now()})
	if len(indices) == 0 {
		res.Status = backend.HealthStatusError
		res.Message = "Generated empty index list"
		return res, nil
	}

	var index string
	var body []byte
	// We try the indices until one successfully queries
	for _, indexName := range indices {
		index = indexName
		osUrl, err := createOpensearchURL(index+"/_mapping/field/"+url.PathEscape(timeField), req.PluginContext.DataSourceInstanceSettings.URL)
		if err != nil {
			res.Status = backend.HealthStatusError
			res.Message = err.Error()
			continue
		}

		request, err := http.NewRequestWithContext(ctx, http.MethodGet, osUrl, bytes.NewBuffer(nil))
		if err != nil {
			res.Status = backend.HealthStatusError
			res.Message = err.Error()
			continue
		}
		request.Header = req.GetHTTPHeaders()

		response, err := ds.HttpClient.Do(request)
		if err != nil {
			res.Status = backend.HealthStatusError
			res.Message = err.Error()
			continue
		}

		body, err = io.ReadAll(response.Body)
		if err != nil {
			res.Status = backend.HealthStatusError
			res.Message = err.Error()
			continue
		}

		if response.StatusCode == 200 {
			res.Status = backend.HealthStatusUnknown
			break
		}
		res.Status = backend.HealthStatusError
		res.Message = string(body)
	}
	if res.Status == backend.HealthStatusError {
		return res, nil
	}

	if db == "" {
		res.Status = backend.HealthStatusOk
		res.Message = "Fields fetched OK. Index not set."
		return res, nil
	}
	jsonData, err = simplejson.NewJson(body)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = fmt.Sprintf("Error parsing response: %s", err)
		return res, nil
	}
	mapping, ok := jsonData.CheckGet(index)
	if !ok {
		res.Status = backend.HealthStatusError
		res.Message = fmt.Sprintf("Index not found: %s", index)
		return res, nil
	}

	timeFieldMapping, ok := mapping.Get("mappings").CheckGet(timeField)
	if !ok {
		res.Status = backend.HealthStatusOk
		res.Message = "Index OK. Note: No field named " + timeField + " found"
		return res, nil
	}

	timeType := timeFieldMapping.Get("mapping").Get(timeField).Get("type")
	if timeType.MustString() != "date" {
		res.Status = backend.HealthStatusOk
		res.Message = "Index OK. Note: " + timeField + " is not a date field"
		return res, nil
	}

	res.Status = backend.HealthStatusOk
	res.Message = "Index OK. Time field name OK."
	return res, nil
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (ds *OpenSearchDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	log.DefaultLogger.Info("QueryData called", "headers", req.Headers)

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

	query := newQueryRequest(osClient, req.Queries, req.PluginContext.DataSourceInstanceSettings, req.GetHTTPHeaders())
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
			q := newQueryRequest(osClient, []backend.DataQuery{prefetchQuery}, req.PluginContext.DataSourceInstanceSettings, req.GetHTTPHeaders())
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
		if backend.IsDownstreamError(err) {
			err = backend.DownstreamError(err) // keeps downstream source if present
		} else {
			err = backend.PluginError(err)
		}
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
	log.DefaultLogger.Info("CallResource called", "path", req.Path, "headers", req.GetHTTPHeaders())

	// allowed paths for resource calls:
	// - empty string for fetching db version
	// - /_mapping for fetching index mapping, e.g. requests going to `index/_mapping`
	// - _msearch for executing getTerms queries
	// - _mapping for fetching "root" index mappings
	if req.Path != "" && !strings.HasSuffix(req.Path, "/_mapping") && req.Path != "_msearch" && req.Path != "_mapping" {
		return fmt.Errorf("invalid resource URL: %s", req.Path)
	}

	osUrl, err := createOpensearchURL(req.Path, req.PluginContext.DataSourceInstanceSettings.URL)
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, req.Method, osUrl, bytes.NewBuffer(req.Body))
	if err != nil {
		return err
	}
	request.Header = req.GetHTTPHeaders()

	log.DefaultLogger.Info("CallResource Request headers", "headers", request.Header)

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

func createOpensearchURL(reqPath string, urlStr string) (string, error) {
	osUrl, err := url.Parse(urlStr)
	if err != nil {
		return "", fmt.Errorf("failed to parse data source URL: %s, error: %w", urlStr, err)
	}
	osUrl.Path = path.Join(osUrl.Path, reqPath)
	osUrlString := osUrl.String()
	// If the request path is empty and the URL does not end with a slash, add a slash to the URL.
	// This ensures that for version checks executed to the root URL, the URL ends with a slash.
	// This is helpful, for example, for load balancers that expect URLs to match the pattern /.*.
	if reqPath == "" && osUrlString[len(osUrlString)-1:] != "/" {
		return osUrl.String() + "/", nil
	}
	return osUrlString, nil
}
