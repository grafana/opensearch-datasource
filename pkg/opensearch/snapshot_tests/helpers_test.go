package snapshot_tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

type queryDataTestRoundTripper struct {
	requestCallback func(req *http.Request) error
	body            []byte
	statusCode      int
}

// we fake the http-request-call. we return a fixed byte-array (defined by the test snapshot),
// and we also check if the http-request-object has the correct data
func (rt *queryDataTestRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	err := rt.requestCallback(req)
	if err != nil {
		return nil, err
	}

	return &http.Response{
		StatusCode: rt.statusCode,
		Header:     http.Header{},
		Body:       io.NopCloser(bytes.NewReader(rt.body)),
	}, nil
}

func newTestDsSettings() *backend.DataSourceInstanceSettings {
	return &backend.DataSourceInstanceSettings{
		JSONData: json.RawMessage(`{
			"database":"opensearch_dashboards_sample_data_flights",
			"flavor":"opensearch",
			"pplEnabled":true,
			"version":"2.3.0",
			"timeField":"timestamp",
			"interval":"Daily",
			"timeInterval":"1s",
			"maxConcurrentShardRequests":42
		}`),
		Database: "[testdb-]YYYY.MM.DD",
		URL:      "http://localhost:9200",
	}
}

func setUpDataQueriesFromFileWithFixedTimeRange(t *testing.T, fileName string) ([]backend.DataQuery, error) {
	t.Helper()
	queriesBytes, err := os.ReadFile(fileName)
	require.NoError(t, err)

	var jsonBytesArray []json.RawMessage
	if err := json.Unmarshal(queriesBytes, &jsonBytesArray); err != nil {
		return nil, fmt.Errorf("error unmarshaling queriesBytes: %w", err)
	}
	var queries []backend.DataQuery
	for _, jsonBytes := range jsonBytesArray {
		var query = backend.DataQuery{
			TimeRange: backend.TimeRange{
				From: time.UnixMilli(1668422437218),
				To:   time.UnixMilli(1668422625668),
			},
			JSON: jsonBytes,
		}
		if err := json.Unmarshal(jsonBytes, &query); err != nil {
			return nil, err
		}

		queries = append(queries, query)
	}
	return queries, nil
}
