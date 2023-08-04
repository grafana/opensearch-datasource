package opensearch

import (
	"fmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"testing"
)

func Test_checkError(t *testing.T) {
	t.Run("checkError intercepts an invalidQueryTypeError and returns a data response with an error message", func(t *testing.T) {
		response, err := checkError(nil, fmt.Errorf("%q is %w",
			"wrong queryType",
			invalidQueryTypeError{refId: "some ref id"}))

		assert.NoError(t, err)
		assert.Equal(t, &backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"some ref id": {
					Error: fmt.Errorf(`invalid queryType, should be Lucene or PPL`)}},
		}, response)
	})

	t.Run("checkError passes on any other type of error and states it's from OpenSearch data source", func(t *testing.T) {
		_, err := checkError(&backend.QueryDataResponse{}, fmt.Errorf("some error"))

		assert.Error(t, err)
		assert.Equal(t, "OpenSearch data source error: some error", err.Error())
	})
}
