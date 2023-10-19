package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_TimeFieldToMilliseconds(t *testing.T) {
	t.Run("if field is string, return timestamp in milliseconds", func(t *testing.T) {
		timestamp, err := TimeFieldToMilliseconds("2021-09-16T15:04:05.000000Z")
		require.NoError(t, err)
		assert.Equal(t, int64(1631804645000), timestamp)
	})
	t.Run("if field is invalid time string, return error", func(t *testing.T) {
		_, err := TimeFieldToMilliseconds("invalid time")
		require.Error(t, err)
	})
	t.Run("if field is number, return timestamp in milliseconds", func(t *testing.T) {
		timestamp, err := TimeFieldToMilliseconds(int64(1631838937218))
		require.NoError(t, err)
		assert.Equal(t, int64(1631838937218), timestamp)
	})
	t.Run("if field is unrecognized time format, return error", func(t *testing.T) {
		_, err := TimeFieldToMilliseconds(true)
		require.Error(t, err)
	})

}

func Test_FlattenNestedFieldsToObj(t *testing.T) {
	t.Run("create object from dot notation", func(t *testing.T) {
		field := map[string]interface{}{
			"span.attributes.sampler@type": "test",
		}
		result := FlattenNestedFieldsToObj(field)
		expected := map[string]interface{}{
			"span": map[string]interface{}{
				"attributes": map[string]interface{}{
					"sampler@type": "test",
				},
			},
		}
		assert.Equal(t, expected, result)
	})
}