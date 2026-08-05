package opensearch

import (
	"sync"
	"time"
)

const (
	// shardCountCacheTTL bounds how long a resolved shard count is reused before we
	// re-query the index. Shard counts change only on reindex, so a few minutes keeps
	// the extra _settings lookup off the hot path without going badly stale.
	shardCountCacheTTL = 5 * time.Minute
	// shardCountCacheMax bounds the cache so rotating concrete index names (e.g.
	// logs-2006.01.02 from the index picker) can't grow it without limit.
	shardCountCacheMax = 1024
)

type shardCountEntry struct {
	count   int64
	expires time.Time
}

// shardCountCache memoizes shard counts across query requests, keyed by
// datasource UID + index. It is process-wide on purpose: each dashboard refresh
// is a new request/handler, so a per-handler cache would re-query every time.
var (
	shardCountMu    sync.Mutex
	shardCountCache = map[string]shardCountEntry{}
)

// numberOfShards returns the number of shards for the query's target index,
// falling back to 1 (exact, single-shard behavior) whenever the count can't be
// determined so a lookup failure never breaks a query. Successful lookups are
// cached per datasource+index for shardCountCacheTTL.
func (h *luceneHandler) numberOfShards(index string) int64 {
	if index == "" {
		index = h.client.GetIndex()
	}
	if index == "" {
		return 1
	}

	var uid string
	if h.dsSettings != nil {
		uid = h.dsSettings.UID
	}
	key := uid + "|" + index

	if count, ok := cachedShardCount(key); ok {
		return count
	}

	n, err := h.client.GetNumberOfShards(index)
	if err != nil || n < 1 {
		// Fall back to single-shard behavior. Don't cache the failure so a
		// transient error is retried on the next query.
		return 1
	}

	storeShardCount(key, int64(n))
	return int64(n)
}

// cachedShardCount returns a non-expired cached shard count for key, if any.
func cachedShardCount(key string) (int64, bool) {
	shardCountMu.Lock()
	defer shardCountMu.Unlock()
	entry, ok := shardCountCache[key]
	if !ok || !time.Now().Before(entry.expires) {
		return 0, false
	}
	return entry.count, true
}

// storeShardCount caches count for key, evicting expired entries (and, if the
// cache is still at capacity, resetting it) so the map stays bounded.
func storeShardCount(key string, count int64) {
	shardCountMu.Lock()
	defer shardCountMu.Unlock()
	if len(shardCountCache) >= shardCountCacheMax {
		now := time.Now()
		for k, entry := range shardCountCache {
			if !now.Before(entry.expires) {
				delete(shardCountCache, k)
			}
		}
		if len(shardCountCache) >= shardCountCacheMax {
			shardCountCache = map[string]shardCountEntry{}
		}
	}
	shardCountCache[key] = shardCountEntry{count: count, expires: time.Now().Add(shardCountCacheTTL)}
}
