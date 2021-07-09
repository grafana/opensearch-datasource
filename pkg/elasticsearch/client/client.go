package es

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-aws-sdk/pkg/sigv4"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/open-distro-for-elasticsearch-grafana-datasource/pkg/tsdb"
	"golang.org/x/net/context/ctxhttp"
)

var (
	clientLog = log.New()
)

// TODO: use real settings for HTTP client
var newDatasourceHttpClient = func(ds *backend.DataSourceInstanceSettings) (*http.Client, error) {
	jsonDataStr := ds.JSONData
	jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
	if err != nil {
		return nil, err
	}

	tlsSkipVerify := jsonData.Get("tlsSkipVerify").MustBool(false)

	var transport http.RoundTripper = &http.Transport{
		TLSClientConfig: &tls.Config{
			Renegotiation:      tls.RenegotiateFreelyAsClient,
			InsecureSkipVerify: tlsSkipVerify,
		},
		Proxy: http.ProxyFromEnvironment,
		Dial: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).Dial,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
	}

	// Add SigV4 middleware if enabled
	if jsonData != nil && jsonData.Get("sigV4Auth").MustBool() {
		log.DefaultLogger.Debug("SigV4 auth enabled")
		sigV4Config, err := GetSigV4Config(ds)
		if err != nil {
			return nil, err
		}

		transport = sigv4.New(sigV4Config, transport)
	}

	return &http.Client{
		Timeout:   30 * time.Second,
		Transport: transport,
	}, nil
}

func GetSigV4Config(ds *backend.DataSourceInstanceSettings) (*sigv4.Config, error) {
	decrypted := ds.DecryptedSecureJSONData
	jsonDataStr := ds.JSONData
	jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
	if err != nil {
		return nil, err
	}

	sigV4Config := &sigv4.Config{
		Service:       "es", // Always "es" for elasticsearch/open distro
		AccessKey:     decrypted["sigV4AccessKey"],
		SecretKey:     decrypted["sigV4SecretKey"],
		Region:        jsonData.Get("sigV4Region").MustString(),
		AssumeRoleARN: jsonData.Get("sigV4AssumeRoleArn").MustString(),
		AuthType:      jsonData.Get("sigV4AuthType").MustString(),
		Profile:       jsonData.Get("sigV4Profile").MustString(),
		ExternalID:    jsonData.Get("sigV4ExternalId").MustString(),
	}

	return sigV4Config, nil
}

// Client represents a client which can interact with elasticsearch api
type Client interface {
	GetVersion() int
	GetTimeField() string
	GetMinInterval(queryInterval string) (time.Duration, error)
	GetIndex() string
	ExecuteMultisearch(r *MultiSearchRequest) (*MultiSearchResponse, error)
	MultiSearch() *MultiSearchRequestBuilder
	ExecutePPLQuery(r *PPLRequest) (*PPLResponse, error)
	PPL() *PPLRequestBuilder
	EnableDebug()
}

// NewClient creates a new elasticsearch client
var NewClient = func(ctx context.Context, ds *backend.DataSourceInstanceSettings, timeRange *backend.TimeRange) (Client, error) {
	jsonDataStr := ds.JSONData
	jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
	if err != nil {
		return nil, err
	}

	version, err := jsonData.Get("esVersion").Int()
	if err != nil {
		return nil, fmt.Errorf("elasticsearch version is required, err=%v", err)
	}

	timeField, err := jsonData.Get("timeField").String()
	if err != nil {
		return nil, fmt.Errorf("elasticsearch time field name is required, err=%v", err)
	}

	indexInterval := jsonData.Get("interval").MustString()
	ip, err := newIndexPattern(indexInterval, ds.Database)
	if err != nil {
		return nil, err
	}

	indices, err := ip.GetIndices(timeRange)
	if err != nil {
		return nil, err
	}

	index, err := ip.GetPPLIndex()
	if err != nil {
		return nil, err
	}

	clientLog.Debug("Creating new client", "version", version, "timeField", timeField, "indices", strings.Join(indices, ", "), "PPL index", index)

	switch version {
	case 2, 5, 56, 60, 70:
		return &baseClientImpl{
			ctx:       ctx,
			ds:        ds,
			version:   version,
			timeField: timeField,
			indices:   indices,
			index:     index,
			timeRange: timeRange,
		}, nil
	}

	return nil, fmt.Errorf("elasticsearch version=%d is not supported", version)
}

type baseClientImpl struct {
	ctx          context.Context
	ds           *backend.DataSourceInstanceSettings
	version      int
	timeField    string
	indices      []string
	index        string
	timeRange    *backend.TimeRange
	debugEnabled bool
}

func (c *baseClientImpl) GetVersion() int {
	return c.version
}

func (c *baseClientImpl) GetTimeField() string {
	return c.timeField
}

func (c *baseClientImpl) GetIndex() string {
	return c.index
}

func (c *baseClientImpl) GetMinInterval(queryInterval string) (time.Duration, error) {
	intervalJSON := simplejson.New()
	intervalJSON.Set("interval", queryInterval)
	return tsdb.GetIntervalFrom(c.ds, intervalJSON, 5*time.Second)
}

func (c *baseClientImpl) getSettings() *simplejson.Json {
	settings, _ := simplejson.NewJson(c.ds.JSONData)
	return settings
}

type multiRequest struct {
	header   map[string]interface{}
	body     interface{}
	interval tsdb.Interval
}

func (c *baseClientImpl) executeBatchRequest(uriPath, uriQuery string, requests []*multiRequest) (*response, error) {
	bytes, err := c.encodeBatchRequests(requests)
	if err != nil {
		return nil, err
	}
	return c.executeRequest(http.MethodPost, uriPath, uriQuery, bytes)
}

func (c *baseClientImpl) encodeBatchRequests(requests []*multiRequest) ([]byte, error) {
	clientLog.Debug("Encoding batch requests to json", "batch requests", len(requests))
	start := time.Now()

	payload := bytes.Buffer{}
	for _, r := range requests {
		reqHeader, err := json.Marshal(r.header)
		if err != nil {
			return nil, err
		}
		payload.WriteString(string(reqHeader) + "\n")

		reqBody, err := json.Marshal(r.body)
		if err != nil {
			return nil, err
		}

		body := string(reqBody)
		body = strings.ReplaceAll(body, "$__interval_ms", strconv.FormatInt(r.interval.Milliseconds(), 10))
		body = strings.ReplaceAll(body, "$__interval", r.interval.Text)

		payload.WriteString(body + "\n")
	}

	elapsed := time.Since(start)
	clientLog.Debug("Encoded batch requests to json", "took", elapsed)

	return payload.Bytes(), nil
}

func (c *baseClientImpl) executeRequest(method, uriPath, uriQuery string, body []byte) (*response, error) {
	u, err := url.Parse(c.ds.URL)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, uriPath)
	u.RawQuery = uriQuery

	var req *http.Request
	if method == http.MethodPost {
		req, err = http.NewRequest(http.MethodPost, u.String(), bytes.NewBuffer(body))
	} else {
		req, err = http.NewRequest(http.MethodGet, u.String(), nil)
	}
	if err != nil {
		return nil, err
	}

	clientLog.Debug("Executing request", "url", req.URL.String(), "method", method)

	var reqInfo *SearchRequestInfo
	if c.debugEnabled {
		reqInfo = &SearchRequestInfo{
			Method: req.Method,
			Url:    req.URL.String(),
			Data:   string(body),
		}
	}

	req.Header.Set("User-Agent", "Grafana")
	req.Header.Set("Content-Type", "application/json")

	secureJsonData := c.ds.DecryptedSecureJSONData

	if c.ds.BasicAuthEnabled {
		clientLog.Debug("Request configured to use basic authentication")
		basicAuthPassword := secureJsonData["basicAuthPassword"]
		req.SetBasicAuth(c.ds.BasicAuthUser, basicAuthPassword)
	}

	if !c.ds.BasicAuthEnabled && c.ds.User != "" {
		clientLog.Debug("Request configured to use basic authentication")
		password := secureJsonData["password"]
		req.SetBasicAuth(c.ds.User, password)
	}

	httpClient, err := newDatasourceHttpClient(c.ds)
	if err != nil {
		return nil, err
	}

	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		clientLog.Debug("Executed request", "took", elapsed)
	}()
	//nolint:bodyclose
	resp, err := ctxhttp.Do(c.ctx, httpClient, req)
	if err != nil {
		return nil, err
	}
	return &response{
		httpResponse: resp,
		reqInfo:      reqInfo,
	}, nil
}

func (c *baseClientImpl) ExecuteMultisearch(r *MultiSearchRequest) (*MultiSearchResponse, error) {
	clientLog.Debug("Executing multisearch", "search requests", len(r.Requests))

	multiRequests := c.createMultiSearchRequests(r.Requests)
	queryParams := c.getMultiSearchQueryParameters()
	clientRes, err := c.executeBatchRequest("_msearch", queryParams, multiRequests)
	if err != nil {
		return nil, err
	}
	res := clientRes.httpResponse
	defer res.Body.Close()

	clientLog.Debug("Received multisearch response", "code", res.StatusCode, "status", res.Status, "content-length", res.ContentLength)

	start := time.Now()
	clientLog.Debug("Decoding multisearch json response")

	var bodyBytes []byte
	if c.debugEnabled {
		tmpBytes, err := ioutil.ReadAll(res.Body)
		if err != nil {
			clientLog.Error("failed to read http response bytes", "error", err)
		} else {
			bodyBytes = make([]byte, len(tmpBytes))
			copy(bodyBytes, tmpBytes)
			res.Body = ioutil.NopCloser(bytes.NewBuffer(tmpBytes))
		}
	}

	var msr MultiSearchResponse
	dec := json.NewDecoder(res.Body)
	err = dec.Decode(&msr)
	if err != nil {
		return nil, err
	}

	elapsed := time.Since(start)
	clientLog.Debug("Decoded multisearch json response", "took", elapsed)

	msr.Status = res.StatusCode

	if c.debugEnabled {
		bodyJSON, err := simplejson.NewFromReader(bytes.NewBuffer(bodyBytes))
		var data *simplejson.Json
		if err != nil {
			clientLog.Error("failed to decode http response into json", "error", err)
		} else {
			data = bodyJSON
		}

		msr.DebugInfo = &SearchDebugInfo{
			Request: clientRes.reqInfo,
			Response: &SearchResponseInfo{
				Status: res.StatusCode,
				Data:   data,
			},
		}
	}

	return &msr, nil
}

func (c *baseClientImpl) createMultiSearchRequests(searchRequests []*SearchRequest) []*multiRequest {
	multiRequests := []*multiRequest{}

	for _, searchReq := range searchRequests {
		mr := multiRequest{
			header: map[string]interface{}{
				"search_type":        "query_then_fetch",
				"ignore_unavailable": true,
				"index":              strings.Join(c.indices, ","),
			},
			body:     searchReq,
			interval: searchReq.Interval,
		}

		if c.version == 2 {
			mr.header["search_type"] = "count"
		}

		if c.version >= 56 && c.version < 70 {
			maxConcurrentShardRequests := c.getSettings().Get("maxConcurrentShardRequests").MustInt(256)
			mr.header["max_concurrent_shard_requests"] = maxConcurrentShardRequests
		}

		multiRequests = append(multiRequests, &mr)
	}

	return multiRequests
}

func (c *baseClientImpl) getMultiSearchQueryParameters() string {
	if c.version >= 70 {
		maxConcurrentShardRequests := c.getSettings().Get("maxConcurrentShardRequests").MustInt(5)
		return fmt.Sprintf("max_concurrent_shard_requests=%d", maxConcurrentShardRequests)
	}

	return ""
}

func (c *baseClientImpl) MultiSearch() *MultiSearchRequestBuilder {
	return NewMultiSearchRequestBuilder(c.GetVersion())
}

func (c *baseClientImpl) EnableDebug() {
	c.debugEnabled = true
}

type pplRequest struct {
	body interface{}
}

func (c *baseClientImpl) executePPLRequest(uriPath string, request *pplRequest) (*pplresponse, error) {
	bytes, err := c.encodePPLRequests(request)
	if err != nil {
		return nil, err
	}
	return c.executePPLQueryRequest(http.MethodPost, uriPath, bytes)
}

func (c *baseClientImpl) encodePPLRequests(requests *pplRequest) ([]byte, error) {
	clientLog.Debug("Encoding PPL requests to json")
	start := time.Now()

	reqBody, err := json.Marshal(requests.body)
	if err != nil {
		return nil, err
	}

	body := string(reqBody)
	// replace the escaped characters in time range filtering
	body = strings.ReplaceAll(body, "\\u003c", "<")
	body = strings.ReplaceAll(body, "\\u003e", ">")

	elapsed := time.Since(start)
	clientLog.Debug("Encoded PPL requests to json", "took", elapsed)

	return []byte(body + "\n"), nil
}

func (c *baseClientImpl) executePPLQueryRequest(method, uriPath string, body []byte) (*pplresponse, error) {
	u, err := url.Parse(c.ds.URL)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, uriPath)

	var req *http.Request
	if method == http.MethodPost {
		req, err = http.NewRequest(http.MethodPost, u.String(), bytes.NewBuffer(body))
	} else {
		req, err = http.NewRequest(http.MethodGet, u.String(), nil)
	}
	if err != nil {
		return nil, err
	}

	clientLog.Debug("Executing request", "url", req.URL.String(), "method", method)

	var reqInfo *PPLRequestInfo
	if c.debugEnabled {
		reqInfo = &PPLRequestInfo{
			Method: req.Method,
			URL:    req.URL.String(),
			Data:   string(body),
		}
	}

	req.Header.Set("User-Agent", "Grafana")
	req.Header.Set("Content-Type", "application/json")

	secureJsonData := c.ds.DecryptedSecureJSONData

	if c.ds.BasicAuthEnabled {
		clientLog.Debug("Request configured to use basic authentication")
		basicAuthPassword := secureJsonData["basicAuthPassword"]
		req.SetBasicAuth(c.ds.BasicAuthUser, basicAuthPassword)
	}

	if !c.ds.BasicAuthEnabled && c.ds.User != "" {
		clientLog.Debug("Request configured to use basic authentication")
		password := secureJsonData["password"]
		req.SetBasicAuth(c.ds.User, password)
	}

	httpClient, err := newDatasourceHttpClient(c.ds)
	if err != nil {
		return nil, err
	}

	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		clientLog.Debug("Executed request", "took", elapsed)
	}()
	//nolint:bodyclose
	resp, err := ctxhttp.Do(c.ctx, httpClient, req)
	if err != nil {
		return nil, err
	}
	return &pplresponse{
		httpResponse: resp,
		reqInfo:      reqInfo,
	}, nil
}

func (c *baseClientImpl) ExecutePPLQuery(r *PPLRequest) (*PPLResponse, error) {
	clientLog.Debug("Executing PPL")

	req := createPPLRequest(r)
	clientRes, err := c.executePPLRequest("_opendistro/_ppl", req)
	if err != nil {
		return nil, err
	}
	resp := clientRes.httpResponse
	defer resp.Body.Close()

	clientLog.Debug("Received PPL response", "code", resp.StatusCode, "status", resp.Status, "content-length", resp.ContentLength)

	start := time.Now()
	clientLog.Debug("Decoding PPL json response")

	var bodyBytes []byte
	if c.debugEnabled {
		tmpBytes, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			clientLog.Error("failed to read http response bytes", "error", err)
		} else {
			bodyBytes = make([]byte, len(tmpBytes))
			copy(bodyBytes, tmpBytes)
			resp.Body = ioutil.NopCloser(bytes.NewBuffer(tmpBytes))
		}
	}

	var pr PPLResponse
	dec := json.NewDecoder(resp.Body)
	err = dec.Decode(&pr)
	if err != nil {
		return nil, err
	}

	elapsed := time.Since(start)
	clientLog.Debug("Decoded PPL json response", "took", elapsed)

	pr.Status = resp.StatusCode

	if c.debugEnabled {
		bodyJSON, err := simplejson.NewFromReader(bytes.NewBuffer(bodyBytes))
		var data *simplejson.Json
		if err != nil {
			clientLog.Error("failed to decode http response into json", "error", err)
		} else {
			data = bodyJSON
		}

		pr.DebugInfo = &PPLDebugInfo{
			Request: clientRes.reqInfo,
			Response: &PPLResponseInfo{
				Status: resp.StatusCode,
				Data:   data,
			},
		}
	}
	if err != nil {
		return nil, err
	}
	return &pr, nil
}

func createPPLRequest(request *PPLRequest) *pplRequest {
	return &pplRequest{
		body: request,
	}
}

func (c *baseClientImpl) PPL() *PPLRequestBuilder {
	return NewPPLRequestBuilder(c.GetIndex())
}
