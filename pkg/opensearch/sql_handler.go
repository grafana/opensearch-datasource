package opensearch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
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
			details := "(no details)"
			if res.Error["reason"] != "" && res.Error["details"] != "" {
				details = fmt.Sprintf("%v, %v", res.Error["reason"], res.Error["details"])
			}
			err = fmt.Errorf("ExecuteSQLQuery received unexpected status code %d: %s", res.Status, details)
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
		queryRes, err := rp.parseResponse(h.client.GetConfiguredFields(), query.Format)
		if err != nil {
			return nil, err
		}
		result.Responses[refID] = *queryRes
	}
	return result, nil
}
