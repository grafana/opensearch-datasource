package opensearch

import (
	"context"
	"encoding/json"
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

	val, ok := o.streamQueries.Load(refId)
	if !ok {
		o.logger.Error("RunStream: query not found in streamQueries map", "refId", refId, "path", req.Path)
		return fmt.Errorf("query with refId %s not found for streaming. Was it registered?", refId)
	}

	defer func() {
		o.logger.Info("RunStream: deleting query from map", "refId", refId)
		o.streamQueries.Delete(refId)
	}()

	streamQuery, queryOk := val.(Query)
	if !queryOk {
		o.logger.Error("RunStream: failed to assert query type from map", "refId", refId, "type", fmt.Sprintf("%T", val))
		return fmt.Errorf("failed to assert query type for refId: %s", refId)
	}

	o.logger.Info("RunStream: starting polling for query", "refId", refId, "rawQuery", streamQuery.RawQuery)

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	var lastTo time.Time
	originalTimeRange := streamQuery.TimeRange
	if !originalTimeRange.To.IsZero() {
		lastTo = originalTimeRange.To
	} else {
		if originalTimeRange.From.IsZero() {
			originalTimeRange.From = time.Now().Add(-5 * time.Minute)
		}
	}

	firstPoll := true

	for {
		select {
		case <-ctx.Done():
			o.logger.Info("RunStream: context canceled, stopping stream", "refId", refId)
			return ctx.Err()
		case <-ticker.C:
			currentTime := time.Now()
			queryForPoll := streamQuery

			if firstPoll {
				queryForPoll.TimeRange.From = originalTimeRange.From
				queryForPoll.TimeRange.To = currentTime
				firstPoll = false
			} else {
				queryForPoll.TimeRange.From = lastTo
				queryForPoll.TimeRange.To = currentTime
			}

			if !queryForPoll.TimeRange.To.After(queryForPoll.TimeRange.From) {
				o.logger.Debug("RunStream: 'To' time is not after 'From' time, skipping poll to avoid empty range", "from", queryForPoll.TimeRange.From, "to", queryForPoll.TimeRange.To)
				continue
			}

			o.logger.Info("RunStream: Polling OpenSearch", "refId", refId, "from", queryForPoll.TimeRange.From, "to", queryForPoll.TimeRange.To)

			osClient, err := client.NewClient(ctx, req.PluginContext.DataSourceInstanceSettings, o.httpClient, &queryForPoll.TimeRange)
			if err != nil {
				o.logger.Error("RunStream: failed to create OpenSearch client for poll", "refId", refId, "error", err)
				continue
			}

			queryJSON, err := json.Marshal(queryForPoll)
			if err != nil {
				o.logger.Error("RunStream: failed to marshal stream query to JSON for backend.DataQuery", "refId", refId, "error", err)
				continue
			}

			backendQuery := backend.DataQuery{
				RefID:     queryForPoll.RefID,
				TimeRange: queryForPoll.TimeRange,
				JSON:      queryJSON,
				QueryType: queryForPoll.QueryType,
			}

			queryExecutor := newQueryRequest(osClient, []backend.DataQuery{backendQuery}, req.PluginContext.DataSourceInstanceSettings)
			queryDataResponse, err := queryExecutor.execute(ctx)

			if err != nil {
				o.logger.Error("RunStream: error executing OpenSearch query poll", "refId", refId, "error", err)
				continue
			}

			var framesToUpdate data.Frames
			if queryDataResponse != nil && queryDataResponse.Responses != nil {
				if respForRefId, found := queryDataResponse.Responses[queryForPoll.RefID]; found {
					if respForRefId.Error != nil {
						o.logger.Error("RunStream: error in query response for poll", "refId", refId, "error", respForRefId.Error)
						continue
					}
					framesToUpdate = respForRefId.Frames
				}
			}

			if len(framesToUpdate) > 0 {
				o.logger.Info("RunStream: new data found", "refId", refId, "frameCount", len(framesToUpdate))
				for _, frame := range framesToUpdate {
					err = sender.SendFrame(frame, data.IncludeAll)
					if err != nil {
						o.logger.Error("RunStream: failed to send frame to frontend", "refId", refId, "error", err)
						return err
					}
				}
				lastTo = queryForPoll.TimeRange.To
			} else {
				o.logger.Debug("RunStream: no new data in this interval", "refId", refId)
			}
		}
	}
}

func (*OpenSearchDatasource) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}
