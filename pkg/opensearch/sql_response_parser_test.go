package opensearch

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetTimeSeriesSQLMeta(t *testing.T) {
	dateHistogramSchema := []client.FieldSchema{
		{Name: "ts", Type: "double"},
		{Name: "COUNT(*)", Type: "double"},
	}

	tests := []struct {
		name          string
		schema        []client.FieldSchema
		datarows      []client.Datarow
		wantErr       string
		wantTimeIndex int
		wantValueIdx  int
		wantFormat    string
	}{
		{
			name: "uses a declared timestamp column",
			schema: []client.FieldSchema{
				{Name: "@timestamp", Type: "timestamp"},
				{Name: "count()", Type: "bigint"},
			},
			datarows:      []client.Datarow{{"2026-06-01 00:00:00", float64(1)}},
			wantTimeIndex: 0,
			wantValueIdx:  1,
			wantFormat:    pplTSFormat,
		},
		{
			name: "uses a declared date column in the second position",
			schema: []client.FieldSchema{
				{Name: "count()", Type: "bigint"},
				{Name: "day", Type: "date"},
			},
			datarows:      []client.Datarow{{float64(1), "2026-06-01"}},
			wantTimeIndex: 1,
			wantValueIdx:  0,
			wantFormat:    pplDateFormat,
		},
		{
			name:          "falls back to values when the bucket key is typed double (first column)",
			schema:        dateHistogramSchema,
			datarows:      []client.Datarow{{"2026-06-01 00:00:00", float64(30)}, {"2026-06-01 00:30:00", float64(28)}},
			wantTimeIndex: 0,
			wantValueIdx:  1,
			wantFormat:    pplTSFormat,
		},
		{
			name:   "falls back to values when the bucket key is typed double (second column)",
			schema: dateHistogramSchema,
			datarows: []client.Datarow{
				{float64(30), "2026-06-01 00:00:00"},
			},
			wantTimeIndex: 1,
			wantValueIdx:  0,
			wantFormat:    pplTSFormat,
		},
		{
			name:   "falls back to a day-granularity bucket key",
			schema: dateHistogramSchema,
			datarows: []client.Datarow{
				{"2026-06-01", float64(30)},
			},
			wantTimeIndex: 0,
			wantValueIdx:  1,
			wantFormat:    pplDateFormat,
		},
		{
			name:          "rejects a response whose values are not dates",
			schema:        dateHistogramSchema,
			datarows:      []client.Datarow{{"catalog", float64(30)}},
			wantErr:       "a valid time field type was not found in response",
			wantTimeIndex: 0,
			wantValueIdx:  0,
			wantFormat:    "",
		},
		{
			name:          "rejects a response where any value fails to parse",
			schema:        dateHistogramSchema,
			datarows:      []client.Datarow{{"2026-06-01 00:00:00", float64(30)}, {"garbage", float64(31)}},
			wantErr:       "a valid time field type was not found in response",
			wantTimeIndex: 0,
			wantValueIdx:  0,
			wantFormat:    "",
		},
		{
			name:          "rejects a response where both columns look like dates",
			schema:        dateHistogramSchema,
			datarows:      []client.Datarow{{"2026-06-01", "2026-06-02"}},
			wantErr:       "a valid time field type was not found in response",
			wantTimeIndex: 0,
			wantValueIdx:  0,
			wantFormat:    "",
		},
		{
			name:          "rejects a response without exactly two columns",
			schema:        []client.FieldSchema{{Name: "ts", Type: "timestamp"}},
			datarows:      []client.Datarow{{"2026-06-01 00:00:00"}},
			wantErr:       "response should have 2 fields but found 1",
			wantTimeIndex: 0,
			wantValueIdx:  0,
			wantFormat:    "",
		},
		{
			name:          "rejects an empty response",
			schema:        dateHistogramSchema,
			datarows:      nil,
			wantErr:       "a valid time field type was not found in response",
			wantTimeIndex: 0,
			wantValueIdx:  0,
			wantFormat:    "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			meta, err := getTimeSeriesSQLMeta(tt.schema, tt.datarows)
			if tt.wantErr != "" {
				assert.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.wantTimeIndex, meta.timeFieldIndex)
			assert.Equal(t, tt.wantValueIdx, meta.valueIndex)
			assert.Equal(t, tt.wantFormat, meta.timeFieldFormat)
		})
	}
}

// A SQL date_histogram response types its bucket key as "double", which the time series parser
// used to reject with "a valid time field type was not found in response".
func TestSQLResponseParser_parseTimeSeriesFromDateHistogram(t *testing.T) {
	rp := newSQLResponseParser(&client.SQLResponse{
		Status: 200,
		Schema: []client.FieldSchema{
			{Name: "ts", Type: "double"},
			{Name: "COUNT(*)", Type: "double"},
		},
		Datarows: []client.Datarow{
			{"2026-06-01 00:00:00", float64(30)},
			{"2026-06-01 00:30:00", float64(28)},
		},
	})

	res, err := rp.parseResponse(client.ConfiguredFields{}, timeSeriesType)
	require.NoError(t, err)
	require.NoError(t, res.Error)
	require.Len(t, res.Frames, 1)

	frame := res.Frames[0]
	require.Len(t, frame.Fields, 2)
	assert.Equal(t, data.FieldTypeNullableTime, frame.Fields[0].Type())
	assert.Equal(t, data.FieldTypeNullableFloat64, frame.Fields[1].Type())
	assert.Equal(t, "COUNT(*)", frame.Fields[1].Name)
	assert.Equal(t, 2, frame.Fields[0].Len())

	first, ok := frame.Fields[0].At(0).(*time.Time)
	require.True(t, ok)
	assert.Equal(t, time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC).UnixMilli(), first.UnixMilli())

	value, ok := frame.Fields[1].At(0).(*float64)
	require.True(t, ok)
	assert.Equal(t, float64(30), *value)
}

// A response whose time column cannot be identified must still surface an error rather than a
// frame with the wrong column used as time.
func TestSQLResponseParser_parseTimeSeriesWithoutTimeField(t *testing.T) {
	rp := newSQLResponseParser(&client.SQLResponse{
		Status: 200,
		Schema: []client.FieldSchema{
			{Name: "service", Type: "keyword"},
			{Name: "COUNT(*)", Type: "double"},
		},
		Datarows: []client.Datarow{{"catalog", float64(30)}},
	})

	res, err := rp.parseResponse(client.ConfiguredFields{}, timeSeriesType)
	require.NoError(t, err)
	require.ErrorContains(t, res.Error, "a valid time field type was not found in response")
	assert.Empty(t, res.Frames)
}
