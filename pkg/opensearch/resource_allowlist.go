package opensearch

import (
	"net/http"
	"path"
	"regexp"
	"strings"
)

// allowedResourceCalls enumerates the (method, path) pairs CallResource
// forwards to OpenSearch; anything else is rejected. The method is checked
// along with the path because the same path can read or write depending on
// it, e.g. GET <index>/_mapping reads a mapping while PUT replaces it.
var allowedResourceCalls = []struct {
	method  string
	pattern *regexp.Regexp
}{
	{http.MethodGet, regexp.MustCompile(`^$`)},                     // version check, used to detect OpenSearch vs Elasticsearch
	{http.MethodGet, regexp.MustCompile(`^([^/]+/)?_field_caps$`)}, // field capabilities, root or index-scoped
	{http.MethodGet, regexp.MustCompile(`^([^/]+/)?_mapping$`)},    // index mapping, kept for older frontends
	{http.MethodPost, regexp.MustCompile(`^_msearch$`)},            // getTerms queries and annotation queries
	{http.MethodGet, regexp.MustCompile(`^_cat/indices$`)},         // index list for the query editor
}

// isAllowedResourceCall reports whether method and reqPath match one of
// allowedResourceCalls.
//
// reqPath must already be in canonical form. createOpensearchURL joins it onto
// the datasource URL with path.Join, which resolves dot segments, so
// "../_mapping" would match a pattern above yet escape a path prefix in the
// datasource URL. Requiring path.Clean to be a no-op makes the checked path
// the one that is sent. A "%" left after Grafana's decoding means the caller
// encoded the path more than once, which the frontend never does.
func isAllowedResourceCall(method, reqPath string) bool {
	if strings.Contains(reqPath, "%") || path.Clean("/"+reqPath) != "/"+reqPath {
		return false
	}
	for _, allowed := range allowedResourceCalls {
		if allowed.method == method && allowed.pattern.MatchString(reqPath) {
			return true
		}
	}
	return false
}
