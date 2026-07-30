package tsdb

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
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

func TestCalculateInterval_TermsProduct(t *testing.T) {
	tests := []struct {
		name         string
		timeRange    *backend.TimeRange
		minInterval  time.Duration
		termsProduct int64
		expectedText string
		// expectedValue is asserted only when non-zero.
		expectedValue time.Duration
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
			// span/1500 value (125.6ms), so the old roundInterval path wins.
			// timeTarget=6000, required=ceil(188450/6000)=32ms,
			// roundIntervalUp(32ms)=50ms < 125.6ms.
			name:          "termsProduct 10 leaves small ranges untouched",
			timeRange:     newFixedRange(),
			minInterval:   0,
			termsProduct:  10,
			expectedText:  "100ms",
			expectedValue: 100 * time.Millisecond,
		},
		{
			// Case 3: timeTarget=60, required=ceil(188450/60)=3141ms,
			// roundIntervalUp(3141ms)=5s. effectiveMin(5s) > span/1500 ->
			// interval is raised to 5s.
			name:          "termsProduct 1000 raises interval to 5s",
			timeRange:     newFixedRange(),
			minInterval:   0,
			termsProduct:  1000,
			expectedText:  "5s",
			expectedValue: 5 * time.Second,
		},
		{
			// Case 4: multi-level product 40*40=1600.
			// timeTarget=floor(60000/1600)=37, required=ceil(188450/37)=5094ms,
			// roundIntervalUp(5094ms)=10s.
			name:          "multi-level product 1600 raises interval to 10s",
			timeRange:     newFixedRange(),
			minInterval:   0,
			termsProduct:  1600,
			expectedText:  "10s",
			expectedValue: 10 * time.Second,
		},
		{
			// Case 5: product just below the bucket budget.
			// timeTarget=floor(60000/59999)=1, required=ceil(188450/1)=188450ms,
			// roundIntervalUp(188450ms)=5m (smallest bracket >= 188.45s, since
			// 2m=120000ms < 188450 <= 300000ms=5m).
			name:          "termsProduct just below budget clamps to 5m",
			timeRange:     newFixedRange(),
			minInterval:   0,
			termsProduct:  59999,
			expectedText:  "5m",
			expectedValue: 5 * time.Minute,
		},
		{
			// Case 6: product just above the bucket budget.
			// timeTarget=floor(60000/60001)=0 -> clamp to 1 -> same path as case 5.
			// The key assertion is: no divide-by-zero / panic, finite result.
			name:          "termsProduct just above budget clamps timeTarget to 1 (no div-by-zero)",
			timeRange:     newFixedRange(),
			minInterval:   0,
			termsProduct:  60001,
			expectedText:  "5m",
			expectedValue: 5 * time.Minute,
		},
		{
			// Case 7: represents the "No limit" terms size (size 0 -> 500).
			// timeTarget=120, required=ceil(188450/120)=1571ms,
			// roundIntervalUp(1571ms)=2s.
			name:          "termsProduct 500 raises interval to 2s",
			timeRange:     newFixedRange(),
			minInterval:   0,
			termsProduct:  500,
			expectedText:  "2s",
			expectedValue: 2 * time.Second,
		},
		{
			// Case 8: long (30-day) range, truncation-undershoot guard.
			// span = 1780704000000 - 1778112000000 = 2592000000ms.
			// timeTarget=120, required=ceil(2592000000/120)=21600000ms=6h,
			// roundIntervalUp(6h)=6h. A naive FormatDuration of a non-bracket
			// value (e.g. 5.5h) would wrongly truncate to "5h"; roundIntervalUp
			// guarantees a clean bracket so FormatDuration yields exactly "6h".
			name:          "long range termsProduct 500 yields clean 6h bracket",
			timeRange:     &backend.TimeRange{From: time.UnixMilli(1778112000000), To: time.UnixMilli(1780704000000)},
			minInterval:   0,
			termsProduct:  500,
			expectedText:  "6h",
			expectedValue: 6 * time.Hour,
		},
		{
			// Case 9: exact 24h boundary regression guard. roundInterval is not
			// idempotent at the 24h bracket (roundInterval(24h)=12h), so without
			// clamping the rounded result the raised floor would be dropped back
			// below budget. span=1500 days -> span/1500 = exactly 24h;
			// timeTarget=60000/30=2000, required=ceil(span/2000)=18h,
			// roundIntervalUp(18h)=24h=floor. The else branch must clamp
			// roundInterval(24h)=12h back up to 24h ("1d"), else buckets would be
			// 3000*30=90000 > budget.
			name:          "exact 24h boundary is not rounded back down below floor",
			timeRange:     &backend.TimeRange{From: time.UnixMilli(0), To: time.UnixMilli(129600000000)},
			minInterval:   0,
			termsProduct:  30,
			expectedText:  "1d",
			expectedValue: 24 * time.Hour,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalculateInterval(tt.timeRange, tt.minInterval, tt.termsProduct)
			assert.Equal(t, tt.expectedText, got.Text)
			if tt.expectedValue != 0 {
				assert.Equal(t, tt.expectedValue, got.Value)
			}
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
