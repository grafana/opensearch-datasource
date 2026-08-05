package client

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/opensearch-datasource/pkg/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseNumberOfShards(t *testing.T) {
	tests := []struct {
		name     string
		body     string
		expected int
		wantErr  bool
	}{
		{
			name:     "single index",
			body:     `{"my-index":{"settings":{"index.number_of_shards":"5"}}}`,
			expected: 5,
		},
		{
			name:     "multiple concrete indices returns the max (conservative)",
			body:     `{"logs-1":{"settings":{"index.number_of_shards":"3"}},"logs-2":{"settings":{"index.number_of_shards":"7"}}}`,
			expected: 7,
		},
		{
			name:    "missing number_of_shards is an error",
			body:    `{"my-index":{"settings":{"index.number_of_replicas":"1"}}}`,
			wantErr: true,
		},
		{
			name:    "non-numeric value is an error",
			body:    `{"my-index":{"settings":{"index.number_of_shards":"lots"}}}`,
			wantErr: true,
		},
		{
			name:    "invalid json is an error",
			body:    `not json`,
			wantErr: true,
		},
		{
			// The shape a mocked _msearch round tripper returns; must not parse as a
			// shard count so callers fall back to single-shard behavior.
			name:    "unrelated payload is an error",
			body:    `{"responses":[]}`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			n, err := parseNumberOfShards([]byte(tt.body))
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.expected, n)
		})
	}
}

func TestGetNumberOfShards(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		rw.Header().Add("Content-Type", "application/json")
		_, _ = rw.Write([]byte(`{"bug-repro":{"settings":{"index.number_of_shards":"5"}}}`))
	}))
	defer ts.Close()

	ds := &backend.DataSourceInstanceSettings{
		URL: ts.URL,
		JSONData: utils.NewRawJsonFromAny(map[string]interface{}{
			"version":   "2.3.0",
			"flavor":    "opensearch",
			"timeField": "@timestamp",
			"database":  "bug-repro",
		}),
	}

	c, err := NewClient(context.Background(), ds, &http.Client{}, nil)
	require.NoError(t, err)

	shards, err := c.GetNumberOfShards("bug-repro")
	require.NoError(t, err)
	assert.Equal(t, 5, shards)

	t.Run("empty index is an error", func(t *testing.T) {
		_, err := c.GetNumberOfShards("")
		require.Error(t, err)
	})
}
