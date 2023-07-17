package opensearch

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	es "github.com/grafana/opensearch-datasource/pkg/opensearch/client"
)

type pplHandler struct {
	client   es.Client
	req      *backend.QueryDataRequest
	builders map[string]*es.PPLRequestBuilder
}

var newPPLHandler = func(client es.Client, req *backend.QueryDataRequest) *pplHandler {
	return &pplHandler{
		client:   client,
		req:      req,
		builders: make(map[string]*es.PPLRequestBuilder),
	}
}

func (h *pplHandler) processQuery(q *Query) error {
	from := h.req.Queries[0].TimeRange.From.UTC().Format("2006-01-02 15:04:05")
	to := h.req.Queries[0].TimeRange.To.UTC().Format("2006-01-02 15:04:05")

	builder := h.client.PPL()
	builder.AddPPLQueryString(h.client.GetConfiguredFields().TimeField, to, from, q.RawQuery)
	h.builders[q.RefID] = builder
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
		rp := newPPLResponseParser(res)
		queryRes, err := rp.parseTimeSeries()
		if err != nil {
			return nil, err
		}
		result.Responses[refID] = *queryRes
	}
	return result, nil
}
