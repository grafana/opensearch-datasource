package opensearch

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	es "github.com/grafana/opensearch-datasource/pkg/opensearch/client"
)

type pplHandler struct {
	client     es.Client
	reqQueries []backend.DataQuery
	builders   map[string]*es.PPLRequestBuilder
	queries    map[string]*Query
}

func newPPLHandler(client es.Client, queries []backend.DataQuery) *pplHandler {
	return &pplHandler{
		client:     client,
		reqQueries: queries,
		builders:   make(map[string]*es.PPLRequestBuilder),
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

func (h *pplHandler) executeQueries() (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	for refID, builder := range h.builders {
		req, err := builder.Build()
		if err != nil {
			return nil, err
		}
		res, err := h.client.ExecutePPLQuery(req)
		if err != nil {
			return nil, err
		}

		query := h.queries[refID]
		rp := newPPLResponseParser(res, query)
		queryRes, err := rp.parseResponse(h.client.GetConfiguredFields(), query.Format)
		if err != nil {
			return nil, err
		}
		result.Responses[refID] = *queryRes
	}
	return result, nil
}
