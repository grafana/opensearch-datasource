package opensearch

import (
	"fmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"testing"
)

func Test_wrapError(t *testing.T) {
	t.Run("wrapError intercepts an invalidQueryTypeError and returns a data response with a wrapped error", func(t *testing.T) {
		wrappedInvalidQueryTypeError := fmt.Errorf("%q is %w",
			"wrong queryType",
			invalidQueryTypeError{refId: "some ref id"})

		actualResponse, err := wrapError(nil, wrappedInvalidQueryTypeError)

		assert.NoError(t, err)
		assert.Equal(t, &backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"some ref id": {
					Error: fmt.Errorf(`%w, expected Lucene or PPL`, wrappedInvalidQueryTypeError)}},
		}, actualResponse)
	})

	t.Run("wrapError passes on any other type of error and states it's from OpenSearch data source", func(t *testing.T) {
		_, err := wrapError(&backend.QueryDataResponse{}, fmt.Errorf("some error"))

		assert.Error(t, err)
		assert.Equal(t, "OpenSearch data source error: some error", err.Error())
	})
}
