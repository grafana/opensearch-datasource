package opensearch

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
)

func (o *OpenSearchDatasource) SubscribeStream(
	ctx context.Context, req *backend.SubscribeStreamRequest,
) (*backend.SubscribeStreamResponse, error) {
	o.logger.Info("SubscribeStream called", "path", req.Path)
	o.logger.Debug("SubscribeStream", "full_req_details", req)

	if !strings.HasPrefix(req.Path, "tail/") {
		o.logger.Error("SubscribeStream: invalid path format", "path", req.Path)
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, fmt.Errorf("invalid path format for stream: %s, expected 'tail/{refId}'", req.Path)
	}

	refIdParts := strings.Split(strings.TrimPrefix(req.Path, "tail/"), "/")
	if len(refIdParts) == 0 || refIdParts[0] == "" {
		o.logger.Error("SubscribeStream: missing refId in path", "path", req.Path)
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, fmt.Errorf("missing refId in stream path: %s", req.Path)
	}

	_, err := o.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		o.logger.Error("SubscribeStream: failed to get datasource info", "error", err)
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, fmt.Errorf("failed to get datasource info: %w", err)
	}

	o.logger.Info("SubscribeStream: path validated, authorizing stream", "path", req.Path)
	return &backend.SubscribeStreamResponse{
		Status: backend.SubscribeStreamStatusOK,
	}, nil
}

func (o *OpenSearchDatasource) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	o.logger.Info("RunStream (Polling Mode) called", "path", req.Path)
	o.logger.Debug("RunStream", "full_req_details", req)

	if !strings.HasPrefix(req.Path, "tail/") {
		o.logger.Error("RunStream: invalid path format", "path", req.Path)
		return fmt.Errorf("RunStream: invalid path format for stream: %s, expected 'tail/{refId}'", req.Path)
	}
	refId := strings.TrimPrefix(req.Path, "tail/")
	if refId == "" {
		o.logger.Error("RunStream: missing refId in path after trim", "path", req.Path)
		return fmt.Errorf("RunStream: missing refId in stream path after trim: %s", req.Path)
	}

	// Get query data directly from the stream request (standard Grafana pattern)
	rawQueryJSON := req.Data
	if len(rawQueryJSON) == 0 {
		o.logger.Error("RunStream: no query data provided in stream request", "refId", refId, "path", req.Path)
		return fmt.Errorf("no query data provided for streaming refId: %s", refId)
	}

	o.logger.Info("RunStream: starting polling for query", "refId", refId, "rawQuery", string(rawQueryJSON))

	ticker := time.NewTicker(2 * time.Second) // Faster polling for more responsive live tailing
	defer ticker.Stop()

	lastTo := time.Now().Add(-1 * time.Second) // Start slightly in the past to catch any timing issues

	for {
		select {
		case <-ctx.Done():
			o.logger.Info("RunStream: context canceled, stopping stream", "refId", refId)
			return ctx.Err()
		case <-ticker.C:
			currentTime := time.Now()
			backendQuery := backend.DataQuery{
				RefID:     refId,
				TimeRange: backend.TimeRange{From: lastTo, To: currentTime},
				JSON:      rawQueryJSON,
			}

			if !backendQuery.TimeRange.To.After(backendQuery.TimeRange.From) {
				o.logger.Debug("RunStream: 'To' time is not after 'From' time, skipping poll to avoid empty range", "from", backendQuery.TimeRange.From, "to", backendQuery.TimeRange.To)
				continue
			}

			o.logger.Info("RunStream: Polling OpenSearch", "refId", refId, "from", backendQuery.TimeRange.From, "to", backendQuery.TimeRange.To, "duration", backendQuery.TimeRange.To.Sub(backendQuery.TimeRange.From))

			osClient, err := client.NewClient(ctx, req.PluginContext.DataSourceInstanceSettings, o.httpClient, &backendQuery.TimeRange)
			if err != nil {
				o.logger.Error("RunStream: failed to create OpenSearch client for poll", "refId", refId, "error", err)
				continue
			}

			queryExecutor := newQueryRequest(osClient, []backend.DataQuery{backendQuery}, req.PluginContext.DataSourceInstanceSettings)
			queryDataResponse, err := queryExecutor.execute(ctx)

			if err != nil {
				o.logger.Error("RunStream: error executing OpenSearch query poll", "refId", refId, "error", err)
				if respForRefId, found := queryDataResponse.Responses[refId]; found {
					respForRefId.Error = err
					json, err := respForRefId.MarshalJSON()
					if err != nil {
						o.logger.Error("RunStream: failed to marshal query response to JSON", "refId", refId, "error", err)
						return err
					}
					err = sender.SendJSON(json)
					if err != nil {
						o.logger.Error("RunStream: failed to send JSON to frontend", "refId", refId, "error", err)
						return err
					}
				}
			}

			var framesToUpdate data.Frames
			if queryDataResponse != nil && queryDataResponse.Responses != nil {
				if respForRefId, found := queryDataResponse.Responses[refId]; found {
					if respForRefId.Error != nil {
						o.logger.Error("RunStream: error in query response for poll", "refId", refId, "error", respForRefId.Error)
						continue
					}
					framesToUpdate = respForRefId.Frames
				}
			}

			var nonEmptyFrames data.Frames
			for _, frame := range framesToUpdate {
				if frameHasRows(frame) {
					nonEmptyFrames = append(nonEmptyFrames, frame)
				}
			}
			if len(nonEmptyFrames) > 0 {
				o.logger.Info("RunStream: new non-empty data found", "refId", refId, "frameCount", len(nonEmptyFrames))
				for _, frame := range nonEmptyFrames {
					err = sender.SendFrame(frame, data.IncludeAll)
					if err != nil {
						o.logger.Error("RunStream: failed to send frame to frontend", "refId", refId, "error", err)
						return err
					}
				}
			} else {
				o.logger.Debug("RunStream: no new non-empty data in this interval", "refId", refId)
			}
			// Always advance lastTo to avoid querying the same time range repeatedly
			lastTo = currentTime
		}
	}
}

func (*OpenSearchDatasource) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

func frameHasRows(frame *data.Frame) bool {
	if frame == nil || len(frame.Fields) == 0 {
		return false
	}
	// All fields should have the same length, so just check the first
	return frame.Fields[0].Len() > 0
}
