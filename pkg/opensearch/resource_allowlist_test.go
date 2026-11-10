package opensearch

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsAllowedResourceCall(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
		allow  bool
	}{
		// Calls the frontend makes.
		{"version check", http.MethodGet, "", true},
		{"root field caps", http.MethodGet, "_field_caps", true},
		{"index-scoped field caps", http.MethodGet, "my-index/_field_caps", true},
		{"root mapping", http.MethodGet, "_mapping", true},
		{"index-scoped mapping", http.MethodGet, "my_index/_mapping", true},
		{"multi-search for getTerms/annotations", http.MethodPost, "_msearch", true},
		{"list indices", http.MethodGet, "_cat/indices", true},

		// Index expressions users configure.
		{"wildcard index", http.MethodGet, "logs-*/_field_caps", true},
		{"comma-separated indices", http.MethodGet, "logs-a,logs-b/_field_caps", true},
		{"cross-cluster index", http.MethodGet, "remote:logs-*/_field_caps", true},
		{"daily index", http.MethodGet, "logstash-2026.10.06/_field_caps", true},

		// Paths the frontend never calls.
		{"arbitrary path", http.MethodGet, "some/other/path", false},
		{"cat aliases", http.MethodGet, "_cat/aliases", false},
		{"cluster settings", http.MethodGet, "_cluster/settings", false},
		{"security api", http.MethodGet, "_plugins/_security/api/roles", false},
		{"extra segment after msearch", http.MethodPost, "_msearch/extra", false},
		{"extra segment after cat/indices", http.MethodGet, "_cat/indices/extra", false},
		{"multiple segments before mapping", http.MethodGet, "my_index/../_cluster/settings/_mapping", false},

		// Allowed paths with a method the frontend never uses.
		{"PUT on index mapping writes instead of reads", http.MethodPut, "my_index/_mapping", false},
		{"DELETE on index mapping", http.MethodDelete, "my_index/_mapping", false},
		{"PUT on root mapping", http.MethodPut, "_mapping", false},
		{"POST on field caps", http.MethodPost, "_field_caps", false},
		{"GET on msearch", http.MethodGet, "_msearch", false},
		{"PUT on cat/indices", http.MethodPut, "_cat/indices", false},
		{"DELETE on empty path", http.MethodDelete, "", false},

		// Paths that path.Join would rewrite before sending.
		{"parent segment as the index", http.MethodGet, "../_mapping", false},
		{"parent segment before field caps", http.MethodGet, "../_field_caps", false},
		{"current segment as the index", http.MethodGet, "./_mapping", false},
		{"bare parent segment", http.MethodGet, "..", false},
		{"empty index segment", http.MethodGet, "/_mapping", false},
		{"trailing slash", http.MethodPost, "_msearch/", false},

		// Paths still encoded after Grafana's decoding.
		{"encoded traversal", http.MethodGet, "my_index%2f..%2f_mapping", false},
		{"encoded wildcard in an otherwise allowed path", http.MethodGet, "my-index%2a/_field_caps", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.allow, isAllowedResourceCall(tt.method, tt.path))
		})
	}
}
