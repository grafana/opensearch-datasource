package opensearch

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
)

type sqlHandler struct {
	client     client.Client
	reqQueries []backend.DataQuery
	builders   map[string]*client.SQLRequestBuilder
	queries    map[string]*Query
}

func newSQLHandler(openSearchClient client.Client, queries []backend.DataQuery) *sqlHandler {
	return &sqlHandler{
		client:     openSearchClient,
		reqQueries: queries,
		builders:   make(map[string]*client.SQLRequestBuilder),
		queries:    make(map[string]*Query),
	}
}

func (h *sqlHandler) processQuery(q *Query) error {
	builder := h.client.SQL()

	// The "Use time range" setting opts out of the injected time filter, matching the
	// equivalent Lucene setting. It is enabled unless explicitly set to false.
	if q.UseTimeRange == nil || *q.UseTimeRange {
		// SQL date literals must be ISO 8601. The space-separated format used by PPL
		// (`2006-01-02 15:04:05`) is accepted for plain queries but makes date_histogram
		// aggregations fail with `failed to parse date field ... with format
		// [strict_date_optional_time||epoch_millis]`, so the `T`/`Z` form is required.
		from := h.reqQueries[0].TimeRange.From.UTC().Format("2006-01-02T15:04:05.000Z07:00")
		to := h.reqQueries[0].TimeRange.To.UTC().Format("2006-01-02T15:04:05.000Z07:00")
		builder.AddSQLQueryString(h.client.GetConfiguredFields().TimeField, to, from, q.RawQuery)
	} else {
		builder.SetSQLQuery(q.RawQuery)
	}

	h.builders[q.RefID] = builder
	h.queries[q.RefID] = q
	return nil
}

func (h *sqlHandler) executeQueries(ctx context.Context) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	for refID, builder := range h.builders {
		req, err := builder.Build()
		if err != nil {
			return &backend.QueryDataResponse{
				Responses: backend.Responses{
					refID: backend.ErrorResponseWithErrorSource(backend.PluginError(err)),
				},
			}, nil
		}
		res, err := h.client.ExecuteSQLQuery(ctx, req)
		if err != nil {
			if backend.IsDownstreamHTTPError(err) {
				err = backend.DownstreamError(err)
			}
			return &backend.QueryDataResponse{
				Responses: backend.Responses{
					refID: backend.ErrorResponseWithErrorSource(err),
				},
			}, nil
		}
		if res.Status >= 400 {
			err = fmt.Errorf("ExecuteSQLQuery received unexpected status code %d: %s", res.Status, sqlErrorMessage(res.Error))
			if backend.ErrorSourceFromHTTPStatus(res.Status) == backend.ErrorSourceDownstream {
				err = backend.DownstreamError(err)
			} else {
				err = backend.PluginError(err)
			}
			return &backend.QueryDataResponse{
				Responses: backend.Responses{
					refID: backend.ErrorResponseWithErrorSource(err),
				},
			}, nil
		}

		query := h.queries[refID]
		rp := newSQLResponseParser(res)
		rp.Alias = query.Alias
		queryRes, err := rp.parseResponse(h.client.GetConfiguredFields(), query.Format)
		if err != nil {
			return nil, err
		}
		if builder.TimeFilterSkipped() {
			// The query ran without the selected time range, which is not visible
			// from the result alone.
			for _, frame := range queryRes.Frames {
				if frame.Meta == nil {
					frame.Meta = &data.FrameMeta{}
				}
				frame.Meta.Notices = append(frame.Meta.Notices, data.Notice{
					Severity: data.NoticeSeverityWarning,
					Text:     "The time field is not configured, so the query was not filtered on the selected time range.",
				})
			}
		}
		result.Responses[refID] = *queryRes
	}
	return result, nil
}

// sqlErrorMessage renders the error an SQL endpoint reported.
//
// The engine puts the summary of a failure in "reason" and the specific cause in
// "details", and either can be absent. Both are reported when they are there,
// because the reason alone is often as generic as "There was internal problem at
// backend", which says nothing about what to fix in the query.
func sqlErrorMessage(sqlError map[string]interface{}) string {
	parts := make([]string, 0, 2)
	for _, key := range []string{"reason", "details"} {
		if value := strings.TrimSpace(fmt.Sprintf("%v", sqlError[key])); value != "" && value != "<nil>" {
			parts = append(parts, value)
		}
	}

	if len(parts) == 0 {
		return "(no details)"
	}

	return strings.Join(parts, ", ")
}
