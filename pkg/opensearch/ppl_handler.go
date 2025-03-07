package opensearch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/errorsource"
	client "github.com/grafana/opensearch-datasource/pkg/opensearch/client"
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
			errWithSource := errorsource.SourceError(backend.ErrorSourceFromHTTPStatus(res.Status), fmt.Errorf("unexpected status code: %d", res.Status), false)
			if res.Error != nil && res.Error["reason"] != "" && res.Error["details"] != "" {
				errWithSource = errorsource.SourceError(backend.ErrorSourceFromHTTPStatus(res.Status), fmt.Errorf("Received an error response %d: %v, %v", res.Status, res.Error["reason"], res.Error["details"]), false)
			}
			return errorsource.AddErrorToResponse(refID, result, errWithSource), nil
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
