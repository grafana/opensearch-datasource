package tsdb

import (
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Canonical fixed range shared with the snapshot tests so the computed
// intervals line up with those fixtures.
//
//	span = 1668422625668 - 1668422437218 = 188450 ms
//	span / defaultRes(1500) = 125.633 ms  -> roundInterval -> 100ms
var (
	fixedFrom = time.UnixMilli(1668422437218)
	fixedTo   = time.UnixMilli(1668422625668)
)

func newFixedRange() *backend.TimeRange {
	return &backend.TimeRange{From: fixedFrom, To: fixedTo}
}

// budget with the default max_buckets: 65535 * 90 / 100 = 58981.
func TestCalculateInterval_TermsProduct(t *testing.T) {
	tests := []struct {
		name         string
		timeRange    *backend.TimeRange
		minInterval  time.Duration
		termsProduct int64
		// maxBuckets defaults to defaultMaxBuckets (65535) when left 0.
		maxBuckets    int64
		expectedText  string
		expectedValue time.Duration
		// expectedRaised asserts the RaisedForBuckets flag.
		expectedRaised bool
		// expectErr asserts CalculateInterval returns ErrBucketBudgetOutOfBounds.
		expectErr bool
	}{
		{
			// Case 1: termsProduct=1 must behave exactly like the old
			// single-arg CalculateInterval. Regression guard.
			name:          "termsProduct 1 is unchanged (regression guard)",
			timeRange:     newFixedRange(),
			minInterval:   0,
			termsProduct:  1,
			expectedText:  "100ms",
			expectedValue: 100 * time.Millisecond,
		},
		{
			// Case 2: small product -> computed floor (50ms) is below the
			// span/1500 value (125.6ms), so the natural roundInterval path wins.
			// timeTarget=5898, required=ceil(188450000000ns/5898)=31.95ms,
			// roundIntervalUp(31.95ms)=50ms < 125.6ms.
			name:          "termsProduct 10 leaves small ranges untouched",
			timeRange:     newFixedRange(),
			minInterval:   0,
			termsProduct:  10,
			expectedText:  "100ms",
			expectedValue: 100 * time.Millisecond,
		},
		{
			// Case 3: timeTarget=58, required=ceil(span/58)=3.249s,
			// roundIntervalUp(3.249s)=5s. effectiveMin(5s) > span/1500 ->
			// interval is raised to 5s.
			name:           "termsProduct 1000 raises interval to 5s",
			timeRange:      newFixedRange(),
			minInterval:    0,
			termsProduct:   1000,
			expectedText:   "5s",
			expectedValue:  5 * time.Second,
			expectedRaised: true,
		},
		{
			// Case 4: multi-level product 40*40=1600.
			// timeTarget=floor(58981/1600)=36, required=ceil(span/36)=5.235s,
			// roundIntervalUp(5.235s)=10s.
			name:           "multi-level product 1600 raises interval to 10s",
			timeRange:      newFixedRange(),
			minInterval:    0,
			termsProduct:   1600,
			expectedText:   "10s",
			expectedValue:  10 * time.Second,
			expectedRaised: true,
		},
		{
			// Case 5: feasibility edge. timeTarget=floor(58981/2949)=20 == minTimeBuckets,
			// so it is still feasible. required=ceil(span/20)=9.4225s,
			// roundIntervalUp(9.4225s)=10s.
			name:           "termsProduct 2949 sits at the feasibility edge and raises to 10s",
			timeRange:      newFixedRange(),
			minInterval:    0,
			termsProduct:   2949,
			expectedText:   "10s",
			expectedValue:  10 * time.Second,
			expectedRaised: true,
		},
		{
			// Case 6: one past the feasibility edge. timeTarget=floor(58981/2950)=19
			// < minTimeBuckets(20) -> ErrBucketBudgetOutOfBounds instead of silently
			// collapsing the series.
			name:         "termsProduct 2950 exceeds the budget and errors",
			timeRange:    newFixedRange(),
			minInterval:  0,
			termsProduct: 2950,
			expectErr:    true,
		},
		{
			// Case 6b: a very large product (timeTarget=0) also errors rather than
			// dividing by zero.
			name:         "termsProduct far above the budget errors (no div-by-zero)",
			timeRange:    newFixedRange(),
			minInterval:  0,
			termsProduct: 60001,
			expectErr:    true,
		},
		{
			// Case 7: represents the "No limit" terms size (size 0 -> 500).
			// timeTarget=117, required=ceil(span/117)=1.611s,
			// roundIntervalUp(1.611s)=2s.
			name:           "termsProduct 500 raises interval to 2s",
			timeRange:      newFixedRange(),
			minInterval:    0,
			termsProduct:   500,
			expectedText:   "2s",
			expectedValue:  2 * time.Second,
			expectedRaised: true,
		},
		{
			// Case 8: long (30-day) range. span=2592000000ms. timeTarget=117,
			// required=ceil(span/117)=6.154h, roundIntervalUp(6.154h)=12h (6h would
			// exceed the 90% budget: 120*500=60000 > 58981). roundIntervalUp
			// guarantees a clean bracket so FormatDuration yields exactly "12h".
			name:           "long range termsProduct 500 yields clean 12h bracket",
			timeRange:      &backend.TimeRange{From: time.UnixMilli(1778112000000), To: time.UnixMilli(1780704000000)},
			minInterval:    0,
			termsProduct:   500,
			expectedText:   "12h",
			expectedValue:  12 * time.Hour,
			expectedRaised: true,
		},
		{
			// Case 9: exact 24h boundary regression guard. roundInterval is not
			// idempotent at the 24h bracket (roundInterval(24h)=12h), so without
			// clamping the rounded result the raised floor would be dropped back
			// below budget. span=1500 days -> span/1500 = exactly 24h;
			// timeTarget=58981/30=1966, required=ceil(span/1966)=18.31h,
			// roundIntervalUp(18.31h)=24h=floor. resolveInterval must clamp
			// roundInterval(24h)=12h back up to 24h ("1d").
			name:           "exact 24h boundary is not rounded back down below floor",
			timeRange:      &backend.TimeRange{From: time.UnixMilli(0), To: time.UnixMilli(129600000000)},
			minInterval:    0,
			termsProduct:   30,
			expectedText:   "1d",
			expectedValue:  24 * time.Hour,
			expectedRaised: true,
		},
		{
			// Case 10: a cluster configured with a lower max_buckets budgets more
			// aggressively. With maxBuckets=10000 (budget=9000), termsProduct=1000
			// leaves only 9 time buckets (< minTimeBuckets) -> error, even though
			// the same product is feasible under the default 65535 limit (case 3).
			// This is the correctness fix for a configurable search.max_buckets.
			name:         "lower configured maxBuckets errors where the default would not",
			timeRange:    newFixedRange(),
			minInterval:  0,
			termsProduct: 1000,
			maxBuckets:   10000,
			expectErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			maxBuckets := tt.maxBuckets
			if maxBuckets == 0 {
				maxBuckets = defaultMaxBuckets
			}
			got, err := CalculateInterval(tt.timeRange, tt.minInterval, tt.termsProduct, maxBuckets)
			if tt.expectErr {
				require.Error(t, err)
				assert.True(t, errors.Is(err, ErrBucketBudgetOutOfBounds), "expected ErrBucketBudgetOutOfBounds, got %v", err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.expectedText, got.Text)
			if tt.expectedValue != 0 {
				assert.Equal(t, tt.expectedValue, got.Value)
			}
			assert.Equal(t, tt.expectedRaised, got.RaisedForBuckets)
		})
	}
}

func TestMaxBucketsFrom(t *testing.T) {
	tests := []struct {
		name     string
		dsInfo   *backend.DataSourceInstanceSettings
		expected int64
	}{
		{
			name:     "nil settings falls back to default",
			dsInfo:   nil,
			expected: defaultMaxBuckets,
		},
		{
			name:     "empty JSONData falls back to default",
			dsInfo:   &backend.DataSourceInstanceSettings{JSONData: []byte(``)},
			expected: defaultMaxBuckets,
		},
		{
			name:     "unset maxBuckets falls back to default",
			dsInfo:   &backend.DataSourceInstanceSettings{JSONData: []byte(`{"timeField":"@timestamp"}`)},
			expected: defaultMaxBuckets,
		},
		{
			name:     "zero maxBuckets falls back to default",
			dsInfo:   &backend.DataSourceInstanceSettings{JSONData: []byte(`{"maxBuckets":0}`)},
			expected: defaultMaxBuckets,
		},
		{
			name:     "configured maxBuckets is used",
			dsInfo:   &backend.DataSourceInstanceSettings{JSONData: []byte(`{"maxBuckets":10000}`)},
			expected: 10000,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, MaxBucketsFrom(tt.dsInfo))
		})
	}
}

func TestRoundIntervalUp(t *testing.T) {
	tests := []struct {
		name     string
		interval time.Duration
		expected time.Duration
	}{
		{
			// smallest bracket >= 15ms is 20ms (10ms < 15ms).
			name:     "15ms rounds up to 20ms",
			interval: 15 * time.Millisecond,
			expected: 20 * time.Millisecond,
		},
		{
			// 44m is between 30m and 1h -> 1h.
			name:     "44m rounds up to 1h",
			interval: 44 * time.Minute,
			expected: time.Hour,
		},
		{
			// 5h30m is between 3h and 6h -> 6h.
			name:     "5h30m rounds up to 6h",
			interval: 5*time.Hour + 30*time.Minute,
			expected: 6 * time.Hour,
		},
		{
			// 2876ms is between 2s and 5s -> 5s.
			name:     "2876ms rounds up to 5s",
			interval: 2876 * time.Millisecond,
			expected: 5 * time.Second,
		},
		{
			// exact bracket stays put.
			name:     "exact 5s stays 5s",
			interval: 5 * time.Second,
			expected: 5 * time.Second,
		},
		{
			// 200s (200000ms) is between 2m and 5m -> 5m (3m is not a bracket).
			name:     "200s rounds up to 5m",
			interval: 200 * time.Second,
			expected: 5 * time.Minute,
		},
		{
			// at/below the smallest bracket -> smallest bracket (10ms).
			name:     "5ms rounds up to smallest bracket 10ms",
			interval: 5 * time.Millisecond,
			expected: 10 * time.Millisecond,
		},
		{
			// above the largest bracket -> largest bracket (1y = 365d).
			name:     "2y is capped at the largest bracket 1y",
			interval: 2 * 365 * 24 * time.Hour,
			expected: 365 * 24 * time.Hour,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, roundIntervalUp(tt.interval))
		})
	}
}
