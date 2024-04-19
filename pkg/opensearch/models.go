package opensearch

import (
	"context"
	"time"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
)

// Query represents the time series query model of the datasource
type Query struct {
	RawQuery        string `json:"query"`
	QueryType       string `json:"queryType"`
	luceneQueryType string
	BucketAggs      []*BucketAgg `json:"bucketAggs"`
	Metrics         []*MetricAgg `json:"metrics"`
	Alias           string       `json:"alias"`
	Interval        time.Duration
	RefID           string
	Format          string
	TimeRange       backend.TimeRange

	// serviceMapInfo is used on the backend to pass information for service map queries
	serviceMapInfo serviceMapInfo
}

// queryHandler is an interface for handling queries of the same type
type queryHandler interface {
	processQuery(q *Query) error
	executeQueries(ctx context.Context) (*backend.QueryDataResponse, error)
}

// BucketAgg represents a bucket aggregation of the time series query model of the datasource
type BucketAgg struct {
	Field    string           `json:"field"`
	ID       string           `json:"id"`
	Settings *simplejson.Json `json:"settings"`
	Type     string           `json:"type"`
}

// MetricAgg represents a metric aggregation of the time series query model of the datasource
type MetricAgg struct {
	Field             string            `json:"field"`
	Hide              bool              `json:"hide"`
	ID                string            `json:"id"`
	PipelineAggregate string            `json:"pipelineAgg"`
	PipelineVariables map[string]string `json:"pipelineVariables"`
	Settings          *simplejson.Json  `json:"settings"`
	Meta              *simplejson.Json  `json:"meta"`
	Type              string            `json:"type"`
}

type serviceMapInfo struct {
	Type       ServiceMapQueryType
	Parameters client.StatsParameters
}

type ServiceMapQueryType int

const (
	Not ServiceMapQueryType = iota
	ServiceMap
	Stats
	Prefetch
)

var metricAggType = map[string]string{
	"count":          "Count",
	"avg":            "Average",
	"sum":            "Sum",
	"max":            "Max",
	"min":            "Min",
	"extended_stats": "Extended Stats",
	"percentiles":    "Percentiles",
	"cardinality":    "Unique Count",
	"moving_avg":     "Moving Average",
	"moving_fn":      "Moving Function",
	"cumulative_sum": "Cumulative Sum",
	"derivative":     "Derivative",
	"bucket_script":  "Bucket Script",
	"raw_document":   "Raw Document",
}

var extendedStats = map[string]string{
	"avg":                        "Avg",
	"min":                        "Min",
	"max":                        "Max",
	"sum":                        "Sum",
	"count":                      "Count",
	"std_deviation":              "Std Dev",
	"std_deviation_bounds_upper": "Std Dev Upper",
	"std_deviation_bounds_lower": "Std Dev Lower",
}

var pipelineAggType = map[string]string{
	"moving_avg":     "moving_avg",
	"moving_fn":      "moving_fn",
	"cumulative_sum": "cumulative_sum",
	"derivative":     "derivative",
	"bucket_script":  "bucket_script",
}

var pipelineAggWithMultipleBucketPathsType = map[string]string{
	"bucket_script": "bucket_script",
}

func isPipelineAgg(metricType string) bool {
	if _, ok := pipelineAggType[metricType]; ok {
		return true
	}
	return false
}

func isPipelineAggWithMultipleBucketPaths(metricType string) bool {
	if _, ok := pipelineAggWithMultipleBucketPathsType[metricType]; ok {
		return true
	}
	return false
}

func describeMetric(metricType, field string) string {
	text := metricAggType[metricType]
	if metricType == countType {
		return text
	}
	return text + " " + field
}

// Query Types
const (
	Lucene = "lucene"
	PPL    = "PPL"
)

// PPL date time type formats
const (
	pplTSFormat   = "2006-01-02 15:04:05.999999"
	pplDateFormat = "2006-01-02"
)
