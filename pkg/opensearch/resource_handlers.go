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
	// if err != nil { // This was for io.ReadAll, not needed now
	// 	ds.logger.Error("handleRegisterStreamQuery: failed to read request body", "refId", refId, "error", err)
	// 	return sender.Send(&backend.CallResourceResponse{
	// 		Status: http.StatusInternalServerError,
	// 		Body:   []byte("Failed to read request body"),
	// 	})
	// }
	// req.Body is automatically closed by the SDK's resource handling (if it were an io.Closer, which it isn't directly here)

	ds.logger.Debug("handleRegisterStreamQuery: received body", "refId", refId, "body", string(bodyBytes))

	var query Query // Using the Query struct from models.go
	if err := json.Unmarshal(bodyBytes, &query); err != nil {
		ds.logger.Error("handleRegisterStreamQuery: failed to unmarshal query", "refId", refId, "error", err, "body", string(bodyBytes))
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusBadRequest,
			Body:   []byte("Failed to unmarshal query payload: " + err.Error()),
		})
	}

	// Store the query. streamQueries is a sync.Map declared in OpenSearchDatasource struct.
	ds.streamQueries.Store(refId, query)
	ds.logger.Info("handleRegisterStreamQuery: successfully stored query for streaming", "refId", refId, "queryIsLuceQueryType", query.luceneQueryType)

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
