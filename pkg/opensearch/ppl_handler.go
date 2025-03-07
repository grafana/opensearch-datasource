package opensearch

import (
	"context"
	"fmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/errorsource"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
)

type pplHandler struct {
	client     client.Client
	reqQueries []backend.DataQuery
	builders   map[string]*client.PPLRequestBuilder
	queries    map[string]*Query
}

func newPPLHandler(openSearchClient client.Client, queries []backend.DataQuery) *pplHandler {
	return &pplHandler{
		client:     openSearchClient,
		reqQueries: queries,
		builders:   make(map[string]*client.PPLRequestBuilder),
		queries:    make(map[string]*Query),
	}
}

func (h *pplHandler) processQuery(q *Query) error {
	from := h.reqQueries[0].TimeRange.From.UTC().Format("2006-01-02 15:04:05")
	to := h.reqQueries[0].TimeRange.To.UTC().Format("2006-01-02 15:04:05")

	builder := h.client.PPL()
	builder.AddPPLQueryString(h.client.GetConfiguredFields().TimeField, to, from, q.RawQuery)
	h.builders[q.RefID] = builder
	h.queries[q.RefID] = q
	return nil
}

func (h *pplHandler) executeQueries(ctx context.Context) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	for refID, builder := range h.builders {
		req, err := builder.Build()
		if err != nil {
			return errorsource.AddPluginErrorToResponse(refID, result, err), nil
		}
		res, err := h.client.ExecutePPLQuery(ctx, req)
		if err != nil {
			if backend.IsDownstreamHTTPError(err) {
				err = errorsource.DownstreamError(err, false)
			}
			return errorsource.AddErrorToResponse(refID, result, err), nil
		}
		if res.Status >= 400 {
			details := "(no details)"
			if res.Error["reason"] != "" && res.Error["details"] != "" {
				details = fmt.Sprintf("%v, %v", res.Error["reason"], res.Error["details"])
			}
			err = fmt.Errorf("ExecutePPLQuery received unexpected status code %d: %s", res.Status, details)
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
		rp := newPPLResponseParser(res)
		queryRes, err := rp.parseResponse(h.client.GetConfiguredFields(), query.Format)
		if err != nil {
			return nil, err
		}
		result.Responses[refID] = *queryRes
	}
	return result, nil
}
