package client

import (
	"strings"

	"github.com/Masterminds/semver"
	"github.com/grafana/opensearch-datasource/pkg/tsdb"
)

// nodeGraphSize is used for setting node graph query sizes. Arbitrarily chosen.
const nodeGraphSize = 1000

// SearchRequestBuilder represents a builder which can build a search request
type SearchRequestBuilder struct {
	flavor       Flavor
	version      *semver.Version
	interval     tsdb.Interval
	size         int
	sort         []map[string]map[string]string
	queryBuilder *QueryBuilder
	aggBuilders  []AggBuilder
	customProps  map[string]interface{}
}

// NewSearchRequestBuilder create a new search request builder
func NewSearchRequestBuilder(flavor Flavor, version *semver.Version, interval tsdb.Interval) *SearchRequestBuilder {
	builder := &SearchRequestBuilder{
		flavor:      flavor,
		version:     version,
		interval:    interval,
		sort:        make([]map[string]map[string]string, 0),
		customProps: make(map[string]interface{}),
		aggBuilders: make([]AggBuilder, 0),
	}
	return builder
}

// Build builds and return a search request
func (b *SearchRequestBuilder) Build() (*SearchRequest, error) {
	sr := SearchRequest{
		Interval:    b.interval,
		Size:        b.size,
		Sort:        b.sort,
		CustomProps: b.customProps,
	}

	if b.queryBuilder != nil {
		q, err := b.queryBuilder.Build()
		if err != nil {
			return nil, err
		}
		sr.Query = q
	}

	if len(b.aggBuilders) > 0 {
		sr.Aggs = make(AggArray, 0)

		for _, ab := range b.aggBuilders {
			aggArray, err := ab.Build()
			if err != nil {
				return nil, err
			}
			sr.Aggs = append(sr.Aggs, aggArray...)
		}
	}

	return &sr, nil
}

// Size sets the size of the search request
func (b *SearchRequestBuilder) Size(size int) *SearchRequestBuilder {
	b.size = size
	return b
}

const defaultOrder = "desc"

// Sort adds a sort to the search request
func (b *SearchRequestBuilder) Sort(order, field, unmappedType string) *SearchRequestBuilder {
	if order != "desc" && order != "asc" {
		order = defaultOrder
	}
	props := map[string]string{
		"order": order,
	}

	if unmappedType != "" {
		props["unmapped_type"] = unmappedType
	}

	b.sort = append(b.sort, map[string]map[string]string{field: props})

	return b
}

const timeFormat = "strict_date_optional_time_nanos"

// SetCustomProps adds timeField as field with standardized time format to not receive
// invalid formats that Elasticsearch/OpenSearch can parse, but our frontend can't (e.g. yyyy_MM_dd_HH_mm_ss)
// https://opensearch.org/docs/latest/api-reference/search/#request-body
// https://opensearch.org/docs/latest/field-types/supported-field-types/date/#full-date-formats
// This is added to different keys in customProps depending on the flavor and version.
//
// This also adds the required {"*", "_source"} value to "fields" for very old versions of Elasticsearch
// for log queries.
func (b *SearchRequestBuilder) SetCustomProps(timeField string, luceneQueryType string) {
	// defaults - OpenSearch or Elasticsearch > 7
	var key = "fields"
	var value any = []any{map[string]string{"field": timeField, "format": timeFormat}}
	if b.flavor == OpenSearch && luceneQueryType == "logs" {
		b.customProps["docvalue_fields"] = []any{timeField}
	}
	if b.flavor == Elasticsearch {
		if b.version.Major() >= 5 && b.version.Major() <= 7 {
			key = "docvalue_fields"
		} else {
			if b.version.Major() < 5 && luceneQueryType == "logs" {
				b.customProps["fielddata_fields"] = []any{timeField}
				b.customProps["fields"] = []any{"*", "_source", value}
				return
			}
		}
	}
	b.customProps[key] = value
}

// Query creates and return a query builder
func (b *SearchRequestBuilder) Query() *QueryBuilder {
	if b.queryBuilder == nil {
		b.queryBuilder = NewQueryBuilder()
	}
	return b.queryBuilder
}

// Agg initiate and returns a new aggregation builder
func (b *SearchRequestBuilder) Agg() AggBuilder {
	aggBuilder := newAggBuilder(b.version, b.flavor)
	b.aggBuilders = append(b.aggBuilders, aggBuilder)
	return aggBuilder
}

// MultiSearchRequestBuilder represents a builder which can build a multi search request
type MultiSearchRequestBuilder struct {
	flavor          Flavor
	version         *semver.Version
	requestBuilders []*SearchRequestBuilder
}

// NewMultiSearchRequestBuilder creates a new multi search request builder
func NewMultiSearchRequestBuilder(flavor Flavor, version *semver.Version) *MultiSearchRequestBuilder {
	return &MultiSearchRequestBuilder{
		flavor:  flavor,
		version: version,
	}
}

type StatsParameters struct {
	ServiceNames []string
	Operations   []string
}

// SetStatsFilters sets the filters for the stats query
// We filter on spans that:
// - Match the given list of services, and either
//   - Have a parent span and match the given operations, or
//   - Have no parent span
func (b *SearchRequestBuilder) SetStatsFilters(to, from int64, traceId string, parameters StatsParameters) {
	fqb := FilterQueryBuilder{}
	fqb.AddTermsFilter("serviceName", parameters.ServiceNames)
	if traceId != "" {
		fqb.AddTermsFilter("traceId", []string{traceId})
	}

	parentFilter := TermsFilter{
		Key:    "parentSpanId",
		Values: []string{""},
	}
	fqb.AddFilterQuery(Query{
		&BoolQuery{
			ShouldFilters: []Filter{
				Query{
					&BoolQuery{
						Filters: []Filter{
							Query{
								&BoolQuery{
									MustNotFilters: []Filter{parentFilter},
								},
							},
							TermsFilter{
								Key:    "name",
								Values: parameters.Operations,
							},
						},
					},
				},
				Query{
					&BoolQuery{
						MustFilters: []Filter{parentFilter},
					},
				},
			},
		},
	})

	timeFilter := &RangeFilter{
		Key: "startTime",
		Lte: to,
		Gte: from,
	}
	b.queryBuilder = &QueryBuilder{
		boolQueryBuilder: &BoolQueryBuilder{
			mustFilterList: &FilterList{
				filters: []Filter{timeFilter},
			},
			filterQueryBuilder: &fqb,
		},
	}

	b.Size(nodeGraphSize)
}

// SetTraceListFilters sets the "query" object of the query to OpenSearch for the trace list
func (b *SearchRequestBuilder) SetTraceListFilters(to, from int64, query string) {
	b.queryBuilder = &QueryBuilder{
		boolQueryBuilder: &BoolQueryBuilder{
			mustFilterList: &FilterList{},
		},
	}
	mustQueryBuilder := b.queryBuilder.boolQueryBuilder.mustFilterList
	mustQueryBuilder.filters = append(mustQueryBuilder.filters,
		&RangeFilter{
			Key: "startTime",
			Lte: to,
			Gte: from,
		})

	if strings.TrimSpace(query) != "" {
		mustQueryBuilder.filters = append(mustQueryBuilder.filters,
			&QueryStringFilter{
				Query:           query,
				AnalyzeWildcard: true,
			})
	}

	b.Size(10)
}

func (b *aggBuilderImpl) ServiceMap() AggBuilder {
	b.Terms("service_name", "serviceName", func(a *TermsAggregation, b AggBuilder) {
		a.Size = nodeGraphSize
		b.Terms("destination_domain", "destination.domain", func(a *TermsAggregation, b AggBuilder) {
			a.Size = nodeGraphSize
			b.Terms("destination_resource", "destination.resource", func(a *TermsAggregation, b AggBuilder) {
				a.Size = nodeGraphSize
			})
		})
		b.Terms("target_domain", "target.domain", func(a *TermsAggregation, b AggBuilder) {
			a.Size = nodeGraphSize
			b.Terms("target_resource", "target.resource", func(a *TermsAggregation, b AggBuilder) {
				a.Size = nodeGraphSize
			})
		})
	})
	return b
}

// Search initiates and returns a new search request builder
func (m *MultiSearchRequestBuilder) Search(interval tsdb.Interval) *SearchRequestBuilder {
	b := NewSearchRequestBuilder(m.flavor, m.version, interval)
	m.requestBuilders = append(m.requestBuilders, b)
	return b
}

// Build builds and return a multi search request
func (m *MultiSearchRequestBuilder) Build() (*MultiSearchRequest, error) {
	requests := []*SearchRequest{}
	for _, sb := range m.requestBuilders {
		searchRequest, err := sb.Build()
		if err != nil {
			return nil, err
		}
		requests = append(requests, searchRequest)
	}

	return &MultiSearchRequest{
		Requests: requests,
	}, nil
}

// QueryBuilder represents a query builder
type QueryBuilder struct {
	boolQueryBuilder *BoolQueryBuilder
}

// NewQueryBuilder create a new query builder
func NewQueryBuilder() *QueryBuilder {
	return &QueryBuilder{}
}

// Build builds and return a query builder
func (b *QueryBuilder) Build() (*Query, error) {
	q := Query{}

	if b.boolQueryBuilder != nil {
		b, err := b.boolQueryBuilder.Build()
		if err != nil {
			return nil, err
		}
		q.Bool = b
	}

	return &q, nil
}

// Bool creates and return a query builder
func (b *QueryBuilder) Bool() *BoolQueryBuilder {
	if b.boolQueryBuilder == nil {
		b.boolQueryBuilder = NewBoolQueryBuilder()
	}
	return b.boolQueryBuilder
}

// BoolQueryBuilder represents a bool query builder
type BoolQueryBuilder struct {
	filterQueryBuilder *FilterQueryBuilder
	mustFilterList     *FilterList
}

// NewBoolQueryBuilder create a new bool query builder
func NewBoolQueryBuilder() *BoolQueryBuilder {
	return &BoolQueryBuilder{}
}

// Filter creates and return a filter query builder
func (b *BoolQueryBuilder) Filter() *FilterQueryBuilder {
	if b.filterQueryBuilder == nil {
		b.filterQueryBuilder = NewFilterQueryBuilder()
	}
	return b.filterQueryBuilder
}

// Build builds and return a bool query builder
func (b *BoolQueryBuilder) Build() (*BoolQuery, error) {
	boolQuery := BoolQuery{}

	if b.filterQueryBuilder != nil {
		filters, err := b.filterQueryBuilder.Build()
		if err != nil {
			return nil, err
		}
		boolQuery.Filters = filters
	}

	if b.mustFilterList != nil {
		boolQuery.MustFilters = b.mustFilterList.filters
	}

	return &boolQuery, nil
}

// FilterQueryBuilder represents a filter query builder
type FilterQueryBuilder struct {
	filters []Filter
}

// NewFilterQueryBuilder creates a new filter query builder
func NewFilterQueryBuilder() *FilterQueryBuilder {
	return &FilterQueryBuilder{
		filters: make([]Filter, 0),
	}
}

// Build builds and return a filter query builder
func (b *FilterQueryBuilder) Build() ([]Filter, error) {
	return b.filters, nil
}

// AddDateRangeFilter adds a new time range filter
func (b *FilterQueryBuilder) AddDateRangeFilter(timeField, format string, lte, gte int64) *FilterQueryBuilder {
	b.filters = append(b.filters, &RangeFilter{
		Key:    timeField,
		Lte:    lte,
		Gte:    gte,
		Format: format,
	})
	return b
}

func (b *FilterQueryBuilder) AddTermsFilter(key string, values []string) *FilterQueryBuilder {
	b.filters = append(b.filters, &TermsFilter{
		Key:    key,
		Values: values,
	})
	return b
}

func (b *FilterQueryBuilder) AddFilterQuery(query Query) *FilterQueryBuilder {
	b.filters = append(b.filters, query)
	return b
}

// AddQueryStringFilter adds a new query string filter
func (b *FilterQueryBuilder) AddQueryStringFilter(querystring string, analyzeWildcard bool) *FilterQueryBuilder {
	if len(strings.TrimSpace(querystring)) == 0 {
		return b
	}

	b.filters = append(b.filters, &QueryStringFilter{
		Query:           querystring,
		AnalyzeWildcard: analyzeWildcard,
	})
	return b
}

// FilterList represents a list of filters
type FilterList struct {
	filters []Filter
}

// AggBuilder represents an aggregation builder
type AggBuilder interface {
	Histogram(key, field string, fn func(a *HistogramAgg, b AggBuilder)) AggBuilder
	DateHistogram(key, field string, fn func(a *DateHistogramAgg, b AggBuilder)) AggBuilder
	Terms(key, field string, fn func(a *TermsAggregation, b AggBuilder)) AggBuilder
	Filters(key string, fn func(a *FiltersAggregation, b AggBuilder)) AggBuilder
	TraceList() AggBuilder
	ServiceMap() AggBuilder
	Stats() AggBuilder
	GeoHashGrid(key, field string, fn func(a *GeoHashGridAggregation, b AggBuilder)) AggBuilder
	Metric(key, metricType, field string, fn func(a *MetricAggregation)) AggBuilder
	Pipeline(key, pipelineType string, bucketPath interface{}, fn func(a *PipelineAggregation)) AggBuilder
	Build() (AggArray, error)
	AddAggDef(*aggDefinition)
}

type aggBuilderImpl struct {
	aggDefs []*aggDefinition
	flavor  Flavor
	version *semver.Version
}

func newAggBuilder(version *semver.Version, flavor Flavor) AggBuilder {
	return &aggBuilderImpl{
		aggDefs: make([]*aggDefinition, 0),
		version: version,
		flavor:  flavor,
	}
}

func (b *aggBuilderImpl) AddAggDef(ad *aggDefinition) {
	b.aggDefs = append(b.aggDefs, ad)
}

func (b *aggBuilderImpl) Build() (AggArray, error) {
	aggs := make(AggArray, 0)

	for _, aggDef := range b.aggDefs {
		agg := &Agg{
			Key:         aggDef.key,
			Aggregation: aggDef.aggregation,
		}

		for _, cb := range aggDef.builders {
			childAggs, err := cb.Build()
			if err != nil {
				return nil, err
			}

			agg.Aggregation.Aggs = append(agg.Aggregation.Aggs, childAggs...)
		}

		aggs = append(aggs, agg)
	}

	return aggs, nil
}

func (b *aggBuilderImpl) Histogram(key, field string, fn func(a *HistogramAgg, b AggBuilder)) AggBuilder {
	innerAgg := &HistogramAgg{
		Field: field,
	}
	aggDef := newAggDefinition(key, &AggContainer{
		Type:        "histogram",
		Aggregation: innerAgg,
	})

	if fn != nil {
		builder := newAggBuilder(b.version, b.flavor)
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) DateHistogram(key, field string, fn func(a *DateHistogramAgg, b AggBuilder)) AggBuilder {
	innerAgg := &DateHistogramAgg{
		Field: field,
	}
	aggDef := newAggDefinition(key, &AggContainer{
		Type:        "date_histogram",
		Aggregation: innerAgg,
	})

	if fn != nil {
		builder := newAggBuilder(b.version, b.flavor)
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

const termsOrderTerm = "_term"

func (b *aggBuilderImpl) Terms(key, field string, fn func(a *TermsAggregation, b AggBuilder)) AggBuilder {
	innerAgg := &TermsAggregation{
		Field: field,
	}
	aggDef := newAggDefinition(key, &AggContainer{
		Type:        "terms",
		Aggregation: innerAgg,
	})

	if fn != nil {
		builder := newAggBuilder(b.version, b.flavor)
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	if (b.version.Major() >= 6 || b.flavor == OpenSearch) && len(innerAgg.Order) > 0 {
		if orderBy, exists := innerAgg.Order[termsOrderTerm]; exists {
			innerAgg.Order["_key"] = orderBy
			delete(innerAgg.Order, termsOrderTerm)
		}
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) Filters(key string, fn func(a *FiltersAggregation, b AggBuilder)) AggBuilder {
	innerAgg := &FiltersAggregation{
		Filters: make(map[string]interface{}),
	}
	aggDef := newAggDefinition(key, &AggContainer{
		Type:        "filters",
		Aggregation: innerAgg,
	})
	if fn != nil {
		builder := newAggBuilder(b.version, b.flavor)
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *SearchRequestBuilder) SetTraceSpansFilters(to, from int64, traceId string) {
	b.queryBuilder = &QueryBuilder{
		boolQueryBuilder: &BoolQueryBuilder{
			mustFilterList: &FilterList{},
		},
	}
	mustQueryBuilder := b.queryBuilder.boolQueryBuilder.mustFilterList
	mustQueryBuilder.filters = append(mustQueryBuilder.filters,
		&RangeFilter{
			Key: "startTime",
			Lte: to,
			Gte: from,
		})
	mustQueryBuilder.filters = append(mustQueryBuilder.filters, MustTerm{
		Term: &Term{
			TraceId: traceId,
		},
	})

}

// Stats adds the needed aggregations for the Stats request, used to
// display latency and throughput
func (b *aggBuilderImpl) Stats() AggBuilder {
	b.Terms("service_name", "serviceName", func(a *TermsAggregation, b AggBuilder) {
		a.Size = nodeGraphSize
		b.Metric("avg_latency_nanos", "avg", "durationInNanos", nil)
		b.AddAggDef(&aggDefinition{
			key: "error_count",
			aggregation: &AggContainer{
				Type:        "filter",
				Aggregation: FilterAggregation{Key: "status.code", Value: "2"},
			},
		})
		b.AddAggDef(&aggDefinition{
			key: "error_rate",
			aggregation: &AggContainer{
				Type: "bucket_script",
				Aggregation: BucketScriptAggregation{
					Path:   map[string]string{"total": "_count", "errors": "error_count._count"},
					Script: "params.errors / params.total",
				},
			},
		})
	})
	return b
}

// TraceList sets the "aggs" object of the query to OpenSearch for the trace list
func (b *aggBuilderImpl) TraceList() AggBuilder {
	aggDef := &aggDefinition{
		key: "traces",
		aggregation: &AggContainer{
			Type: "terms",
			Aggregation: &struct {
				Field string            `json:"field"`
				Size  int               `json:"size"`
				Order map[string]string `json:"order"`
			}{
				Field: "traceId",
				Size:  100,
				Order: map[string]string{"_key": "asc"},
			},
			Aggs: AggArray{
				{
					Key: "latency",
					Aggregation: &AggContainer{
						Type: "max",
						Aggregation: &struct {
							Script struct {
								Source string `json:"source"`
								Lang   string `json:"lang"`
							} `json:"script"`
						}{
							Script: struct {
								Source string `json:"source"`
								Lang   string `json:"lang"`
							}{
								Source: "\n                if (doc.containsKey('traceGroupFields.durationInNanos') && !doc['traceGroupFields.durationInNanos'].empty) {\n                  return Math.round(doc['traceGroupFields.durationInNanos'].value / 10000) / 100.0\n                }\n                return 0\n                ",
								Lang:   "painless"},
						},
					},
				},
				{
					Key: "trace_group",
					Aggregation: &AggContainer{
						Type: "terms",
						Aggregation: &struct {
							Field string `json:"field"`
							Size  int    `json:"size"`
						}{
							Field: "traceGroup",
							Size:  1,
						},
					},
				},
				{
					Key: "error_count",
					Aggregation: &AggContainer{
						Type:        "filter",
						Aggregation: map[string]map[string]string{"term": {"traceGroupFields.statusCode": "2"}},
					},
				},
				{
					Key: "last_updated",
					Aggregation: &AggContainer{
						Type: "max",
						Aggregation: &struct {
							Field string `json:"field"`
						}{
							Field: "traceGroupFields.endTime",
						},
					},
				},
			},
		},
		builders: make([]AggBuilder, 0),
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) GeoHashGrid(key, field string, fn func(a *GeoHashGridAggregation, b AggBuilder)) AggBuilder {
	innerAgg := &GeoHashGridAggregation{
		Field:     field,
		Precision: 5,
	}
	aggDef := newAggDefinition(key, &AggContainer{
		Type:        "geohash_grid",
		Aggregation: innerAgg,
	})

	if fn != nil {
		builder := newAggBuilder(b.version, b.flavor)
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) Metric(key, metricType, field string, fn func(a *MetricAggregation)) AggBuilder {
	innerAgg := &MetricAggregation{
		Field:    field,
		Settings: make(map[string]interface{}),
	}
	aggDef := newAggDefinition(key, &AggContainer{
		Type:        metricType,
		Aggregation: innerAgg,
	})

	if fn != nil {
		fn(innerAgg)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) Pipeline(key, pipelineType string, bucketPath interface{}, fn func(a *PipelineAggregation)) AggBuilder {
	innerAgg := &PipelineAggregation{
		BucketPath: bucketPath,
		Settings:   make(map[string]interface{}),
	}
	aggDef := newAggDefinition(key, &AggContainer{
		Type:        pipelineType,
		Aggregation: innerAgg,
	})

	if fn != nil {
		fn(innerAgg)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}
