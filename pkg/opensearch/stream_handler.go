package opensearch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func (ds *OpenSearchDatasource) SubscribeStream(
	ctx context.Context, req *backend.SubscribeStreamRequest,
) (*backend.SubscribeStreamResponse, error) {
	dsInfo, err := ds.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, err
	}

	// Expect tail/${key}
	if !strings.HasPrefix(req.Path, "tail/") {
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, fmt.Errorf("expected tail in channel path")
	}

	query := &Query{}
	if err := json.Unmarshal(req.Data, query); err != nil {
		return nil, err
	}

	if query.RawQuery == "" {
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, fmt.Errorf("missing expr in channel (subscribe)")
	}

	dsInfo.streamsMu.RLock()
	defer dsInfo.streamsMu.RUnlock()

	cache, ok := dsInfo.streams[req.Path]
	if ok {
		msg, err := backend.NewInitialData(cache.Bytes(data.IncludeAll))
		return &backend.SubscribeStreamResponse{
			Status:      backend.SubscribeStreamStatusOK,
			InitialData: msg,
		}, err
	}

	// nothing yet
	return &backend.SubscribeStreamResponse{
		Status: backend.SubscribeStreamStatusOK,
	}, err
}

func (s *OpenSearchDatasource) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return err
	}

	query := &Query{}
	if err := json.Unmarshal(req.Data, query); err != nil {
		return err
	}
	if query.RawQuery == "" {
		return fmt.Errorf("missing expr in channel")
	}

	logger := s.logger.FromContext(ctx)
	count := int64(0)

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	params := url.Values{}
	params.Add("query", query.RawQuery)

	webSocketUrl, _ := url.Parse(dsInfo.URL)

	webSocketUrl.Path = "/opensearch/api/tail"

	if webSocketUrl.Scheme == "https" {
		webSocketUrl.Scheme = "wss"
	} else {
		webSocketUrl.Scheme = "ws"
	}
	webSocketUrl.RawQuery = params.Encode()

	logger.Info("Connecting to websocket", "url", webSocketUrl)
	c, r, err := websocket.DefaultDialer.Dial(webSocketUrl.String(), nil)
	if err != nil {
		logger.Error("Error connecting to websocket", "err", err)
		return fmt.Errorf("error connecting to websocket")
	}

	defer func() {
		dsInfo.streamsMu.Lock()
		delete(dsInfo.streams, req.Path)
		dsInfo.streamsMu.Unlock()
		if r != nil {
			_ = r.Body.Close()
		}
		err = c.Close()
		logger.Error("Closing loki websocket", "err", err)
	}()

	prev := data.FrameJSONCache{}

	// Read all messages
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				logger.Error("Websocket read:", "err", err)
				return
			}

			frame := &data.Frame{}
			err = json.Unmarshal(message, &frame)

			if err == nil && frame != nil {
				next, _ := data.FrameToJSONCache(frame)
				if next.SameSchema(&prev) {
					err = sender.SendBytes(next.Bytes(data.IncludeDataOnly))
				} else {
					err = sender.SendFrame(frame, data.IncludeAll)
				}
				prev = next

				// Cache the initial data
				dsInfo.streamsMu.Lock()
				dsInfo.streams[req.Path] = prev
				dsInfo.streamsMu.Unlock()
			}

			if err != nil {
				logger.Error("Websocket write:", "err", err, "raw", message)
				return
			}
		}
	}()

	ticker := time.NewTicker(time.Second * 60) // .Step)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			logger.Info("Socket done")
			return nil
		case <-ctx.Done():
			logger.Info("Stop streaming (context canceled)")
			return nil
		case t := <-ticker.C:
			count++
			logger.Error("Opensearch websocket ping?", "time", t, "count", count)
		}
	}
}

func (s *OpenSearchDatasource) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}
