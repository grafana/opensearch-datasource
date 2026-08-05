package opensearch

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/grafana/opensearch-datasource/pkg/tsdb"
	"github.com/grafana/opensearch-datasource/pkg/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func termsAgg(size string) *BucketAgg {
	return &BucketAgg{
		Type:     termsType,
		Settings: utils.NewJsonFromAny(map[string]interface{}{"size": size}),
	}
}

func TestTermsBucketEstimate(t *testing.T) {
	tests := []struct {
		name     string
		size     int
		shards   int64
		expected int64
	}{
		{name: "single shard is exact (size)", size: 5, shards: 1, expected: 5},
		{name: "single shard large size is exact", size: 1000, shards: 1, expected: 1000},
		{name: "zero shards treated as single shard", size: 5, shards: 0, expected: 5},
		// shard_size = int(size*1.5)+10; 5 -> 17; *5 shards = 85.
		{name: "five shards over-request small size", size: 5, shards: 5, expected: 85},
		// shard_size = 1500+10 = 1510; *5 = 7550.
		{name: "five shards over-request large size", size: 1000, shards: 5, expected: 7550},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, termsBucketEstimate(tt.size, tt.shards))
		})
	}
}

func TestTermsBucketProduct_ShardAware(t *testing.T) {
	const ceiling int64 = 58981

	t.Run("single terms, single shard equals size", func(t *testing.T) {
		got := termsBucketProduct([]*BucketAgg{termsAgg("5")}, 1, ceiling)
		assert.Equal(t, int64(5), got)
	})

	t.Run("single terms, five shards uses shard_size", func(t *testing.T) {
		got := termsBucketProduct([]*BucketAgg{termsAgg("5")}, 5, ceiling)
		assert.Equal(t, int64(85), got)
	})

	t.Run("non-terms aggs are ignored", func(t *testing.T) {
		date := &BucketAgg{Type: dateHistType, Settings: utils.NewJsonFromAny(map[string]interface{}{"interval": "auto"})}
		got := termsBucketProduct([]*BucketAgg{date, termsAgg("5")}, 5, ceiling)
		assert.Equal(t, int64(85), got)
	})

	t.Run("multiple terms multiply and cap at ceiling", func(t *testing.T) {
		got := termsBucketProduct([]*BucketAgg{termsAgg("1000"), termsAgg("1000")}, 5, ceiling)
		// 7550 * 7550 >> ceiling, so it clamps.
		assert.Equal(t, ceiling, got)
	})
}

// Test_size5_five_shards_raises_interval is the regression for the multi-shard
// gap: a terms size of 5 on a 5-shard index over 30 days overflows because
// OpenSearch counts shards*shard_size buckets, not size. The shard-aware product
// must push the interval up so the query stays under the limit.
func Test_size5_five_shards_raises_interval(t *testing.T) {
	const maxBuckets int64 = 65535
	// 30-day range (2,592,000,000 ms).
	timeRange := &backend.TimeRange{
		From: time.UnixMilli(1778112000000),
		To:   time.UnixMilli(1780704000000),
	}

	// Single-shard: estimate is size (5); natural 30-min interval is fine, no raise.
	singleShard := termsBucketProduct([]*BucketAgg{termsAgg("5")}, 1, maxBuckets)
	require.Equal(t, int64(5), singleShard)
	got, err := tsdb.CalculateInterval(timeRange, 0, singleShard, maxBuckets)
	require.NoError(t, err)
	assert.False(t, got.RaisedForBuckets, "single-shard size 5 should not need raising")

	// Five-shard: estimate is 85, which raises the interval to 2h so the bucket
	// count (360 time buckets * 85 = 30,600) stays under the limit.
	fiveShard := termsBucketProduct([]*BucketAgg{termsAgg("5")}, 5, maxBuckets)
	require.Equal(t, int64(85), fiveShard)
	got, err = tsdb.CalculateInterval(timeRange, 0, fiveShard, maxBuckets)
	require.NoError(t, err)
	assert.True(t, got.RaisedForBuckets, "five-shard size 5 should be raised")
	assert.Equal(t, "2h", got.Text)
}

func TestNumberOfShards_FallbackAndCache(t *testing.T) {
	newHandler := func(c client.Client) *luceneHandler {
		return newLuceneHandler(c, nil, &backend.DataSourceInstanceSettings{})
	}

	t.Run("client error falls back to 1 and is not cached", func(t *testing.T) {
		c := newFakeClient(client.OpenSearch, "2.3.0")
		c.numberOfShardsError = assertErr
		h := newHandler(c)
		assert.Equal(t, int64(1), h.numberOfShards("err-index"))
		_, cached := cachedShardCount("|err-index")
		assert.False(t, cached, "failures should not be cached")
	})

	t.Run("empty index resolves to configured index then falls back to 1", func(t *testing.T) {
		c := newFakeClient(client.OpenSearch, "2.3.0")
		c.index = ""
		h := newHandler(c)
		assert.Equal(t, int64(1), h.numberOfShards(""))
	})

	t.Run("successful lookup is cached", func(t *testing.T) {
		c := newFakeClient(client.OpenSearch, "2.3.0")
		c.numberOfShards = 5
		h := newHandler(c)
		assert.Equal(t, int64(5), h.numberOfShards("cache-index"))

		// Even if the client would now return a different value, the cached one wins.
		c.numberOfShards = 9
		assert.Equal(t, int64(5), h.numberOfShards("cache-index"))
	})
}

var assertErr = errFakeShards{}

type errFakeShards struct{}

func (errFakeShards) Error() string { return "shard lookup failed" }
