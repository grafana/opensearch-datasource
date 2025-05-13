package opensearch

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// handleRegisterStreamQuery handles the HTTP request to register a query for a streaming session.
func (ds *OpenSearchDatasource) handleRegisterStreamQuery(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ds.logger.Info("handleRegisterStreamQuery called", "path", req.Path, "method", req.Method)

	if req.Method != http.MethodPost {
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusMethodNotAllowed,
			Body:   []byte("Method not allowed"),
		})
	}

	// Extract refId from path, e.g., /_stream_query_register/{refId}
	// The path in CallResourceRequest does not include the initial /resources prefix.
	pathParts := strings.Split(strings.TrimPrefix(req.Path, "_stream_query_register/"), "/")
	if len(pathParts) == 0 || pathParts[0] == "" {
		ds.logger.Error("handleRegisterStreamQuery: missing refId in path", "path", req.Path)
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusBadRequest,
			Body:   []byte("Missing refId in path"),
		})
	}
	refId := pathParts[0]

	// req.Body is already []byte, no need for io.ReadAll
	bodyBytes := req.Body

	ds.logger.Debug("handleRegisterStreamQuery: received body", "refId", refId, "body", string(bodyBytes))

	// Store the raw query JSON as json.RawMessage for streaming
	var rawQueryJSON json.RawMessage = bodyBytes
	ds.streamQueries.Store(refId, rawQueryJSON)
	ds.logger.Info("handleRegisterStreamQuery: successfully stored raw query JSON for streaming", "refId", refId)

	// Send a JSON response
	responseBody := map[string]string{"message": "Query registered for streaming"}
	jsonBody, err := json.Marshal(responseBody)
	if err != nil {
		ds.logger.Error("handleRegisterStreamQuery: failed to marshal JSON response", "refId", refId, "error", err)
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusInternalServerError,
			Body:   []byte("Error creating success response"), // Keep simple error for brevity
		})
	}

	return sender.Send(&backend.CallResourceResponse{
		Status:  http.StatusOK,
		Body:    jsonBody,
		Headers: map[string][]string{"Content-Type": {"application/json"}}, // Explicitly set Content-Type for the response
	})
}
