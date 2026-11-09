package opensearch

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCheckHealthIndexResolution covers the health check over an index, an alias
// or an index pattern. OpenSearch resolves an alias to the concrete indices it
// points at and keys the mapping response by those names, so the configured
// name is not part of the response.
func TestCheckHealthIndexResolution(t *testing.T) {
	tests := []struct {
		name            string
		index           string
		mappingResponse string
		wantStatus      backend.HealthStatus
		wantMessage     string
	}{
		{
			name:            "a concrete index",
			index:           "logs-2026.06.01",
			mappingResponse: `{"logs-2026.06.01":{"mappings":{"@timestamp":{"full_name":"@timestamp","mapping":{"@timestamp":{"type":"date"}}}}}}`,
			wantStatus:      backend.HealthStatusOk,
			wantMessage:     "Index OK. Time field name OK.",
		},
		{
			name:            "an alias that resolves to a single index",
			index:           "log-repository-minutely",
			mappingResponse: `{"logs-2026.06.01":{"mappings":{"@timestamp":{"full_name":"@timestamp","mapping":{"@timestamp":{"type":"date"}}}}}}`,
			wantStatus:      backend.HealthStatusOk,
			wantMessage:     "Index OK. Time field name OK.",
		},
		{
			name:            "an alias that resolves to several indices",
			index:           "log-repository-minutely",
			mappingResponse: `{"logs-2026.06.01":{"mappings":{"@timestamp":{"full_name":"@timestamp","mapping":{"@timestamp":{"type":"date"}}}}},"logs-2026.06.02":{"mappings":{"@timestamp":{"full_name":"@timestamp","mapping":{"@timestamp":{"type":"date"}}}}}}`,
			wantStatus:      backend.HealthStatusOk,
			wantMessage:     "Index OK. Time field name OK.",
		},
		{
			name:            "an index pattern",
			index:           "logs-*",
			mappingResponse: `{"logs-2026.06.01":{"mappings":{"@timestamp":{"full_name":"@timestamp","mapping":{"@timestamp":{"type":"date"}}}}}}`,
			wantStatus:      backend.HealthStatusOk,
			wantMessage:     "Index OK. Time field name OK.",
		},
		{
			name:            "an alias that resolves to an index without the time field",
			index:           "log-repository-minutely",
			mappingResponse: `{"logs-2026.06.01":{"mappings":{"message":{"full_name":"message","mapping":{"message":{"type":"text"}}}}}}`,
			wantStatus:      backend.HealthStatusOk,
			wantMessage:     "Index OK. Note: No field named @timestamp found",
		},
		{
			name:            "an index that does not exist",
			index:           "missing-index",
			mappingResponse: `{}`,
			wantStatus:      backend.HealthStatusError,
			wantMessage:     "Index not found: missing-index",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
				rw.Header().Set("Content-Type", "application/json")
				fmt.Fprint(rw, tt.mappingResponse)
			}))
			defer server.Close()

			ds := &OpenSearchDatasource{HttpClient: server.Client()}
			settings := backend.DataSourceInstanceSettings{
				URL:      server.URL,
				JSONData: []byte(fmt.Sprintf(`{"flavor":"opensearch","version":"3.9.0","timeField":"@timestamp","database":%q,"interval":""}`, tt.index)),
			}

			res, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{
				PluginContext: backend.PluginContext{DataSourceInstanceSettings: &settings},
			})
			require.NoError(t, err)
			require.NotNil(t, res)
			assert.Equal(t, tt.wantStatus, res.Status)
			assert.Equal(t, tt.wantMessage, res.Message)
		})
	}
}
