package main

import (
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/opensearch-datasource/pkg/opensearch"
)

func main() {
	// Start listening to requests send from Grafana. This call is blocking so
	// it wont finish until Grafana shutsdown the process or the plugin choose
	// to exit close down by itself
	err := datasource.Manage("grafana-opensearch-datasource", opensearch.NewOpenSearchDatasourceInstance, datasource.ManageOpts{})

	// Log any error if we could start the plugin.
	if err != nil {
		log.DefaultLogger.Error(err.Error())
		os.Exit(1)
	}
}
