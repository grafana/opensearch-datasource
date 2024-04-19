package client

import (
	"encoding/json"
	"net/http"

	simplejson "github.com/bitly/go-simplejson"

	"github.com/grafana/opensearch-datasource/pkg/tsdb"
)

type Flavor string

const (
	Elasticsearch Flavor = "elasticsearch"
	OpenSearch    Flavor = "opensearch"
)

type response struct {
	httpResponse *http.Response
	reqInfo      *SearchRequestInfo
}

type SearchRequestInfo struct {
	Method string `json:"method"`
	Url    string `json:"url"`
	Data   string `json:"data"`
}

type SearchResponseInfo struct {
	Status int              `json:"status"`
	Data   *simplejson.Json `json:"data"`
}

type SearchDebugInfo struct {
	Request  *SearchRequestInfo  `json:"request"`
	Response *SearchResponseInfo `json:"response"`
}

// SearchRequest represents a search request
type SearchRequest struct {
	Interval    tsdb.Interval
	Size        int
	Sort        []map[string]map[string]string
	Query       *Query
	Aggs        AggArray
	CustomProps map[string]interface{}
}

// MarshalJSON returns the JSON encoding of the request.
func (r *SearchRequest) MarshalJSON() ([]byte, error) {
	root := make(map[string]interface{})

	root["size"] = r.Size
	if len(r.Sort) > 0 {
		root["sort"] = r.Sort
	}

	for key, value := range r.CustomProps {
		root[key] = value
	}

	root["query"] = r.Query

	if len(r.Aggs) > 0 {
		root["aggs"] = r.Aggs
	}

	return json.Marshal(root)
}

// SearchResponseHits represents search response hits
type SearchResponseHits struct {
	Hits []map[string]interface{}
}

// SearchResponse represents a search response
type SearchResponse struct {
	Error        map[string]interface{} `json:"error"`
	Aggregations map[string]interface{} `json:"aggregations"`
	Hits         *SearchResponseHits    `json:"hits"`
}

// MultiSearchRequest represents a multi search request
type MultiSearchRequest struct {
	Requests []*SearchRequest
}

// MultiSearchResponse represents a multi search response
type MultiSearchResponse struct {
	Status    int               `json:"status,omitempty"`
	Responses []*SearchResponse `json:"responses"`
	DebugInfo *SearchDebugInfo  `json:"-"`
}

// Query represents a query
type Query struct {
	Bool *BoolQuery `json:"bool"`
}

// BoolQuery represents a bool query
type BoolQuery struct {
	Filters        []Filter
	MustFilters    []Filter
	MustNotFilters []Filter
	ShouldFilters  []Filter
}

// MarshalJSON returns the JSON encoding of the boolean query.
func (q *BoolQuery) MarshalJSON() ([]byte, error) {
	root := make(map[string]interface{})

	if len(q.Filters) > 0 {
		if len(q.Filters) == 1 {
			root["filter"] = q.Filters[0]
		} else {
			root["filter"] = q.Filters
		}
	}

	if len(q.MustFilters) > 0 {
		if len(q.MustFilters) == 1 {
			root["must"] = q.MustFilters[0]
		} else {
			root["must"] = q.MustFilters
		}
	}

	if len(q.ShouldFilters) > 0 {
		if len(q.ShouldFilters) == 1 {
			root["should"] = q.ShouldFilters[0]
		} else {
			root["should"] = q.ShouldFilters
		}
	}
	if len(q.MustNotFilters) > 0 {
		if len(q.MustNotFilters) == 1 {
			root["must_not"] = q.MustNotFilters[0]
		} else {
			root["must_not"] = q.MustNotFilters
		}
	}

	return json.Marshal(root)
}

// Filter represents a search filter
type Filter interface{}

type Term struct {
	TraceId string `json:"traceId,omitempty"`
}
type MustTerm struct {
	Term *Term `json:"term,omitempty"`
}

// QueryStringFilter represents a query string search filter
type QueryStringFilter struct {
	Filter
	Query           string
	AnalyzeWildcard bool
}

// MarshalJSON returns the JSON encoding of the query string filter.
func (f *QueryStringFilter) MarshalJSON() ([]byte, error) {
	root := map[string]interface{}{
		"query_string": map[string]interface{}{
			"query":            f.Query,
			"analyze_wildcard": f.AnalyzeWildcard,
		},
	}

	return json.Marshal(root)
}

// TermsFilter represents a terms filter
type TermsFilter struct {
	Key    string
	Values []string
}

func (t TermsFilter) MarshalJSON() ([]byte, error) {
	if len(t.Values) == 1 {
		return json.Marshal(map[string]map[string]map[string]string{
			"term": {
				t.Key: {"value": t.Values[0]},
			},
		})
	} else {
		return json.Marshal(map[string]map[string][]string{
			"terms": {
				t.Key: t.Values,
			},
		})
	}
}

// RangeFilter represents a range search filter
type RangeFilter struct {
	Filter
	Key    string
	Gte    int64
	Lte    int64
	Format string
}

// DateFormatEpochMS represents a date format of epoch milliseconds (epoch_millis)
const DateFormatEpochMS = "epoch_millis"

// MarshalJSON returns the JSON encoding of the query string filter.
func (f *RangeFilter) MarshalJSON() ([]byte, error) {
	root := map[string]map[string]map[string]interface{}{
		"range": {
			f.Key: {
				"lte": f.Lte,
				"gte": f.Gte,
			},
		},
	}

	if f.Format != "" {
		root["range"][f.Key]["format"] = f.Format
	}

	return json.Marshal(root)
}

// Aggregation represents an aggregation
type Aggregation interface{}

// Agg represents a key and aggregation
type Agg struct {
	Key         string
	Aggregation *AggContainer
}

// MarshalJSON returns the JSON encoding of the agg
func (a *Agg) MarshalJSON() ([]byte, error) {
	root := map[string]interface{}{
		a.Key: a.Aggregation,
	}

	return json.Marshal(root)
}

// AggArray represents a collection of key/aggregation pairs
type AggArray []*Agg

// MarshalJSON returns the JSON encoding of the agg
func (a AggArray) MarshalJSON() ([]byte, error) {
	aggsMap := make(map[string]Aggregation)

	for _, subAgg := range a {
		aggsMap[subAgg.Key] = subAgg.Aggregation
	}

	return json.Marshal(aggsMap)
}

type AggContainer struct {
	Type        string
	Aggregation Aggregation
	Aggs        AggArray
}

// MarshalJSON returns the JSON encoding of the aggregation container
func (a *AggContainer) MarshalJSON() ([]byte, error) {
	root := map[string]interface{}{
		a.Type: a.Aggregation,
	}

	if len(a.Aggs) > 0 {
		root["aggs"] = a.Aggs
	}

	return json.Marshal(root)
}

type aggDefinition struct {
	key         string
	aggregation *AggContainer
	builders    []AggBuilder
}

func newAggDefinition(key string, aggregation *AggContainer) *aggDefinition {
	return &aggDefinition{
		key:         key,
		aggregation: aggregation,
		builders:    make([]AggBuilder, 0),
	}
}

// HistogramAgg represents a histogram aggregation
type HistogramAgg struct {
	Interval    int    `json:"interval,omitempty"`
	Field       string `json:"field"`
	MinDocCount int    `json:"min_doc_count"`
	Missing     *int   `json:"missing,omitempty"`
}

// DateHistogramAgg represents a date histogram aggregation
type DateHistogramAgg struct {
	Field          string          `json:"field"`
	Interval       string          `json:"interval,omitempty"`
	MinDocCount    int             `json:"min_doc_count"`
	Missing        *string         `json:"missing,omitempty"`
	ExtendedBounds *ExtendedBounds `json:"extended_bounds"`
	Format         string          `json:"format"`
	Offset         string          `json:"offset,omitempty"`
}

// FiltersAggregation represents a filters aggregation
type FiltersAggregation struct {
	Filters map[string]interface{} `json:"filters"`
}

type FilterAggregation struct {
	Key   string
	Value string
}

func (f FilterAggregation) MarshalJSON() ([]byte, error) {
	root := map[string]interface{}{
		"term": map[string]string{
			f.Key: f.Value,
		},
	}
	return json.Marshal(root)
}

type BucketScriptAggregation struct {
	Path   map[string]string `json:"buckets_path"`
	Script string            `json:"script"`
}

// TermsAggregation represents a terms aggregation
type TermsAggregation struct {
	Field       string                 `json:"field"`
	Size        int                    `json:"size"`
	Order       map[string]interface{} `json:"order,omitempty"`
	MinDocCount *int                   `json:"min_doc_count,omitempty"`
	Missing     *string                `json:"missing,omitempty"`
}

// ExtendedBounds represents extended bounds
type ExtendedBounds struct {
	Min int64 `json:"min"`
	Max int64 `json:"max"`
}

// GeoHashGridAggregation represents a geo hash grid aggregation
type GeoHashGridAggregation struct {
	Field     string `json:"field"`
	Precision int    `json:"precision"`
}

// MetricAggregation represents a metric aggregation
type MetricAggregation struct {
	Field    string
	Settings map[string]interface{}
}

// MarshalJSON returns the JSON encoding of the metric aggregation
func (a *MetricAggregation) MarshalJSON() ([]byte, error) {
	root := map[string]interface{}{
		"field": a.Field,
	}

	for k, v := range a.Settings {
		if k != "" && v != nil {
			root[k] = v
		}
	}
	return json.Marshal(root)
}

// PipelineAggregation represents a metric aggregation
type PipelineAggregation struct {
	BucketPath interface{}
	Settings   map[string]interface{}
}

// MarshalJSON returns the JSON encoding of the pipeline aggregation
func (a *PipelineAggregation) MarshalJSON() ([]byte, error) {
	root := map[string]interface{}{
		"buckets_path": a.BucketPath,
	}

	for k, v := range a.Settings {
		if k != "" && v != nil {
			root[k] = v
		}
	}
	return json.Marshal(root)
}

type pplresponse struct {
	httpResponse *http.Response
	reqInfo      *PPLRequestInfo
}

type PPLRequestInfo struct {
	Method string `json:"method"`
	URL    string `json:"url"`
	Data   string `json:"data"`
}

type PPLResponseInfo struct {
	Status int              `json:"status"`
	Data   *simplejson.Json `json:"data"`
}

type PPLDebugInfo struct {
	Request  *PPLRequestInfo  `json:"request"`
	Response *PPLResponseInfo `json:"response"`
}

// PPLRequest represents the PPL query object.
type PPLRequest struct {
	Query string
}

// MarshalJSON returns the JSON encoding of the PPL query string filter.
func (req *PPLRequest) MarshalJSON() ([]byte, error) {
	root := map[string]interface{}{
		"query": req.Query,
	}
	return json.Marshal(root)
}

// PPLResponse represents a PPL response
type PPLResponse struct {
	Status    int                    `json:"status,omitempty"`
	Error     map[string]interface{} `json:"error"`
	Schema    []FieldSchema          `json:"schema"`
	Datarows  []Datarow              `json:"datarows"`
	DebugInfo *PPLDebugInfo          `json:"-"`
}

// FieldSchema represents the schema for a single field from the PPL response result set
type FieldSchema struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// Datarow represents a datarow from the PPL response result set
type Datarow []interface{}
