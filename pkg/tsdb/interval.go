package tsdb

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var (
	defaultRes int64 = 1500
	year             = time.Hour * 24 * 365
	day              = time.Hour * 24
)

const (
	// defaultMaxBuckets matches OpenSearch's default search.max_buckets. It is
	// used when the datasource does not specify a maxBuckets override.
	defaultMaxBuckets int64 = 65535
	// bucketHeadroomPercent is the fraction of max_buckets we budget for the
	// date histogram, leaving headroom for parent-level and extended_bounds
	// buckets.
	bucketHeadroomPercent int64 = 90
	// minTimeBuckets is the fewest date histogram buckets we are willing to
	// collapse a series into. Below this the query is not usable, so we surface an
	// error instead of silently returning a near-empty chart.
	minTimeBuckets int64 = 20
)

// ErrBucketBudgetOutOfBounds means no interval can keep the query under the
// bucket limit while still returning a usable series.
var ErrBucketBudgetOutOfBounds = errors.New("bucket budget out of bounds")

type Interval struct {
	Text  string
	Value time.Duration
	// RaisedForBuckets is true when the interval was increased above its natural
	// value to keep the total bucket count within the max_buckets budget.
	RaisedForBuckets bool
}

func (i *Interval) Milliseconds() int64 {
	return i.Value.Nanoseconds() / int64(time.Millisecond)
}

// MaxBucketsFrom reads the configured search.max_buckets budget from the datasource
// settings, falling back to defaultMaxBuckets when it is unset or invalid. It is
// safe to call with a nil dsInfo.
func MaxBucketsFrom(dsInfo *backend.DataSourceInstanceSettings) int64 {
	if dsInfo == nil {
		return defaultMaxBuckets
	}
	jsonData, err := simplejson.NewJson([]byte(dsInfo.JSONData))
	if err != nil {
		return defaultMaxBuckets
	}
	if v, err := jsonData.Get("maxBuckets").Int64(); err == nil && v > 0 {
		return v
	}
	return defaultMaxBuckets
}

// CalculateInterval returns the date histogram interval for the given time range.
// When terms aggregations multiply the bucket count (termsProduct > 1) the interval
// is raised so the total stays within the max_buckets budget. It returns
// ErrBucketBudgetOutOfBounds when no interval can keep the query under the limit
// while still returning a usable series.
func CalculateInterval(timeRange *backend.TimeRange, minInterval time.Duration, termsProduct, maxBuckets int64) (Interval, error) {
	span := timeRange.To.UnixNano() - timeRange.From.UnixNano()

	floor, err := bucketFloorInterval(span, termsProduct, maxBuckets)
	if err != nil {
		return Interval{}, err
	}

	effectiveMin := minInterval
	if floor > effectiveMin {
		effectiveMin = floor
	}

	natural := resolveInterval(span, minInterval)
	budgeted := resolveInterval(span, effectiveMin)

	return Interval{
		Text:             FormatDuration(budgeted),
		Value:            budgeted,
		RaisedForBuckets: budgeted > natural,
	}, nil
}

// resolveInterval reproduces the historical interval calculation: span/defaultRes,
// rounded to a clean bracket, but never below min. roundInterval can round down (and
// is not idempotent at the 24h/7d brackets), so the result is clamped back up to min.
func resolveInterval(span int64, min time.Duration) time.Duration {
	interval := time.Duration(span / defaultRes)
	if interval < min {
		return min
	}
	if rounded := roundInterval(interval); rounded >= min {
		return rounded
	}
	return min
}

// bucketFloorInterval computes the smallest date histogram interval that keeps the
// total bucket count (time buckets multiplied by termsProduct) within the budgeted
// share of maxBuckets. It returns 0 when termsProduct <= 1 so behavior is unchanged
// for queries without terms aggregations, and ErrBucketBudgetOutOfBounds when the
// terms product leaves fewer than minTimeBuckets time buckets.
func bucketFloorInterval(span, termsProduct, maxBuckets int64) (time.Duration, error) {
	if termsProduct <= 1 {
		return 0, nil
	}

	budget := maxBuckets * bucketHeadroomPercent / 100
	timeTarget := budget / termsProduct
	if timeTarget < minTimeBuckets {
		return 0, fmt.Errorf(
			"%w: terms aggregations would produce up to %d buckets per time bucket, "+
				"leaving fewer than %d time buckets within the %d bucket limit; "+
				"reduce the terms size or narrow the time range",
			ErrBucketBudgetOutOfBounds, termsProduct, minTimeBuckets, maxBuckets)
	}

	// integer ceil division to get the required interval in nanoseconds
	required := (span + timeTarget - 1) / timeTarget

	return roundIntervalUp(time.Duration(required)), nil
}

// roundIntervalUp returns the smallest interval bracket greater than or equal to the
// given interval. Each bracket renders cleanly via FormatDuration. If the interval is
// larger than the largest bracket, the largest bracket (1y) is returned.
func roundIntervalUp(interval time.Duration) time.Duration {
	brackets := []time.Duration{
		10 * time.Millisecond,
		20 * time.Millisecond,
		50 * time.Millisecond,
		100 * time.Millisecond,
		200 * time.Millisecond,
		500 * time.Millisecond,
		time.Second,
		2 * time.Second,
		5 * time.Second,
		10 * time.Second,
		15 * time.Second,
		20 * time.Second,
		30 * time.Second,
		time.Minute,
		2 * time.Minute,
		5 * time.Minute,
		10 * time.Minute,
		15 * time.Minute,
		20 * time.Minute,
		30 * time.Minute,
		time.Hour,
		2 * time.Hour,
		3 * time.Hour,
		6 * time.Hour,
		12 * time.Hour,
		24 * time.Hour,
		7 * 24 * time.Hour,
		30 * 24 * time.Hour,
		365 * 24 * time.Hour,
	}

	for _, bracket := range brackets {
		if interval <= bracket {
			return bracket
		}
	}
	return brackets[len(brackets)-1]
}

func GetIntervalFrom(dsInfo *backend.DataSourceInstanceSettings, queryModel *simplejson.Json, defaultInterval time.Duration) (time.Duration, error) {
	jsonDataStr := dsInfo.JSONData
	jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
	if err != nil {
		return time.Duration(0), err
	}

	interval := queryModel.Get("interval").MustString("")

	if interval == "" && jsonData != nil {
		dsInterval := jsonData.Get("timeInterval").MustString("")
		if dsInterval != "" {
			interval = dsInterval
		}
	}

	if interval == "" {
		return defaultInterval, nil
	}

	interval = strings.Replace(strings.Replace(interval, "<", "", 1), ">", "", 1)
	parsedInterval, err := time.ParseDuration(interval)
	if err != nil {
		return time.Duration(0), err
	}

	return parsedInterval, nil
}

// FormatDuration converts a duration into the kbn format e.g. 1m 2h or 3d
func FormatDuration(inter time.Duration) string {
	if inter >= year {
		return fmt.Sprintf("%dy", inter/year)
	}

	if inter >= day {
		return fmt.Sprintf("%dd", inter/day)
	}

	if inter >= time.Hour {
		return fmt.Sprintf("%dh", inter/time.Hour)
	}

	if inter >= time.Minute {
		return fmt.Sprintf("%dm", inter/time.Minute)
	}

	if inter >= time.Second {
		return fmt.Sprintf("%ds", inter/time.Second)
	}

	if inter >= time.Millisecond {
		return fmt.Sprintf("%dms", inter/time.Millisecond)
	}

	return "1ms"
}

// nolint: gocyclo
func roundInterval(interval time.Duration) time.Duration {
	switch {
	// 0.015s
	case interval <= 15*time.Millisecond:
		return time.Millisecond * 10 // 0.01s
	// 0.035s
	case interval <= 35*time.Millisecond:
		return time.Millisecond * 20 // 0.02s
	// 0.075s
	case interval <= 75*time.Millisecond:
		return time.Millisecond * 50 // 0.05s
	// 0.15s
	case interval <= 150*time.Millisecond:
		return time.Millisecond * 100 // 0.1s
	// 0.35s
	case interval <= 350*time.Millisecond:
		return time.Millisecond * 200 // 0.2s
	// 0.75s
	case interval <= 750*time.Millisecond:
		return time.Millisecond * 500 // 0.5s
	// 1.5s
	case interval <= 1500*time.Millisecond:
		return time.Millisecond * 1000 // 1s
	// 3.5s
	case interval <= 3500*time.Millisecond:
		return time.Millisecond * 2000 // 2s
	// 7.5s
	case interval <= 7500*time.Millisecond:
		return time.Millisecond * 5000 // 5s
	// 12.5s
	case interval <= 12500*time.Millisecond:
		return time.Millisecond * 10000 // 10s
	// 17.5s
	case interval <= 17500*time.Millisecond:
		return time.Millisecond * 15000 // 15s
	// 25s
	case interval <= 25000*time.Millisecond:
		return time.Millisecond * 20000 // 20s
	// 45s
	case interval <= 45000*time.Millisecond:
		return time.Millisecond * 30000 // 30s
	// 1.5m
	case interval <= 90000*time.Millisecond:
		return time.Millisecond * 60000 // 1m
	// 3.5m
	case interval <= 210000*time.Millisecond:
		return time.Millisecond * 120000 // 2m
	// 7.5m
	case interval <= 450000*time.Millisecond:
		return time.Millisecond * 300000 // 5m
	// 12.5m
	case interval <= 750000*time.Millisecond:
		return time.Millisecond * 600000 // 10m
	// 12.5m
	case interval <= 1050000*time.Millisecond:
		return time.Millisecond * 900000 // 15m
	// 25m
	case interval <= 1500000*time.Millisecond:
		return time.Millisecond * 1200000 // 20m
	// 45m
	case interval <= 2700000*time.Millisecond:
		return time.Millisecond * 1800000 // 30m
	// 1.5h
	case interval <= 5400000*time.Millisecond:
		return time.Millisecond * 3600000 // 1h
	// 2.5h
	case interval <= 9000000*time.Millisecond:
		return time.Millisecond * 7200000 // 2h
	// 4.5h
	case interval <= 16200000*time.Millisecond:
		return time.Millisecond * 10800000 // 3h
	// 9h
	case interval <= 32400000*time.Millisecond:
		return time.Millisecond * 21600000 // 6h
	// 24h
	case interval <= 86400000*time.Millisecond:
		return time.Millisecond * 43200000 // 12h
	// 48h
	case interval <= 172800000*time.Millisecond:
		return time.Millisecond * 86400000 // 24h
	// 1w
	case interval <= 604800000*time.Millisecond:
		return time.Millisecond * 86400000 // 24h
	// 3w
	case interval <= 1814400000*time.Millisecond:
		return time.Millisecond * 604800000 // 1w
	// 2y
	case interval < 3628800000*time.Millisecond:
		return time.Millisecond * 2592000000 // 30d
	default:
		return time.Millisecond * 31536000000 // 1y
	}
}
