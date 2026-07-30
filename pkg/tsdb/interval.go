package tsdb

import (
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

// maxBucketsTarget is the number of date histogram buckets we aim to stay under.
// OpenSearch's default search.max_buckets is 65535; we target below it to leave
// headroom for parent-level and extended_bounds buckets. This could later be made
// configurable via datasource settings.
const maxBucketsTarget int64 = 60000

type Interval struct {
	Text  string
	Value time.Duration
}

func (i *Interval) Milliseconds() int64 {
	return i.Value.Nanoseconds() / int64(time.Millisecond)
}

func CalculateInterval(timeRange *backend.TimeRange, minInterval time.Duration, termsProduct int64) Interval {
	to := timeRange.To.UnixNano()
	from := timeRange.From.UnixNano()
	interval := time.Duration((to - from) / defaultRes)

	// When terms aggregations multiply the bucket count, raise the minimum
	// interval so we stay under OpenSearch's search.max_buckets limit.
	floor := bucketFloorInterval(timeRange, termsProduct)
	effectiveMin := minInterval
	if floor > effectiveMin {
		effectiveMin = floor
	}

	if interval < effectiveMin {
		return Interval{Text: FormatDuration(effectiveMin), Value: effectiveMin}
	}

	rounded := roundInterval(interval)
	// roundInterval can round down (and is not idempotent at the 24h/7d brackets),
	// which could drop the interval back below the required floor. Clamp so the
	// bucket budget is never exceeded.
	if rounded < effectiveMin {
		rounded = effectiveMin
	}
	return Interval{Text: FormatDuration(rounded), Value: rounded}
}

// bucketFloorInterval computes the smallest date histogram interval that keeps the
// total bucket count (time buckets multiplied by termsProduct) under maxBucketsTarget.
// It returns 0 when termsProduct <= 1 so behavior is unchanged for queries without
// terms aggregations.
func bucketFloorInterval(timeRange *backend.TimeRange, termsProduct int64) time.Duration {
	if termsProduct <= 1 {
		return 0
	}

	timeTarget := maxBucketsTarget / termsProduct
	if timeTarget < 1 {
		timeTarget = 1
	}

	span := timeRange.To.UnixNano() - timeRange.From.UnixNano()
	// integer ceil division to get the required interval in nanoseconds
	required := (span + timeTarget - 1) / timeTarget

	return roundIntervalUp(time.Duration(required))
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
