package client

import (
	"encoding/json"
	"testing"

	"github.com/bitly/go-simplejson"
	"github.com/stretchr/testify/assert"
)

func TestPPLRequest(t *testing.T) {
	t.Run("Test OpenSearch PPL request", func(t *testing.T) {
		timeField := "@timestamp"
		index := "default_index"
		t.Run("Given new PPL request builder", func(t *testing.T) {
			b := NewPPLRequestBuilder(index)

			t.Run("When building PPL request", func(t *testing.T) {
				pr, err := b.Build()
				assert.NoError(t, err)

				t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
					body, err := json.Marshal(pr)
					assert.NoError(t, err)
					json, err := simplejson.NewJson(body)
					assert.NoError(t, err)
					assert.Equal(t, "", json.Get("query").Interface())
				})
			})

			t.Run("When adding default query", func(t *testing.T) {
				b.AddPPLQueryString(timeField, "$timeTo", "$timeFrom", "")

				t.Run("When building PPL request", func(t *testing.T) {
					pr, err := b.Build()
					assert.NoError(t, err)

					t.Run("Should have query string filter", func(t *testing.T) {
						f := pr.Query
						assert.Equal(t, "source = default_index | where `@timestamp` >= '$timeFrom' and `@timestamp` <= '$timeTo'", f)
					})

					t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
						body, err := json.Marshal(pr)
						assert.NoError(t, err)
						json, err := simplejson.NewJson(body)
						assert.NoError(t, err)
						assert.Equal(t, "source = default_index | where `@timestamp` >= '$timeFrom' and `@timestamp` <= '$timeTo'", json.Get("query").Interface())
					})
				})
			})
			t.Run("When adding PPL query", func(t *testing.T) {
				b.AddPPLQueryString(timeField, "$timeTo", "$timeFrom", "source = index | fields test")

				t.Run("When building PPL request", func(t *testing.T) {
					pr, err := b.Build()
					assert.NoError(t, err)

					t.Run("Should have query string filter", func(t *testing.T) {
						f := pr.Query
						assert.Equal(t, "source = index | where `@timestamp` >= '$timeFrom' and `@timestamp` <= '$timeTo' | fields test", f)
					})

					t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
						body, err := json.Marshal(pr)
						assert.NoError(t, err)
						json, err := simplejson.NewJson(body)
						assert.NoError(t, err)
						assert.Equal(t, "source = index | where `@timestamp` >= '$timeFrom' and `@timestamp` <= '$timeTo' | fields test", json.Get("query").Interface())
					})
				})
			})
		})
	})
}

func Test_AddPPLQueryString_prepends_a_source_index_for_ppl_request_with_ad_hoc_filter_and_no_source_index_in_the_query_string(t *testing.T) {
	b := NewPPLRequestBuilder("default_index")
	b.AddPPLQueryString("@timestamp", "$timeTo", "$timeFrom", " | where `ad_hoc_filter` = 'ad_hoc_filter_value'")
	pr, err := b.Build()
	assert.NoError(t, err)
	assert.Equal(t, "source = default_index | where `@timestamp` >= '$timeFrom' and `@timestamp` <= '$timeTo' | where `ad_hoc_filter` = 'ad_hoc_filter_value'", pr.Query)
}

func Test_AddPPLQueryString_does_not_prepend_source_index_if_query_starts_with_search_source_command(t *testing.T) {
	b := NewPPLRequestBuilder("default_index")
	b.AddPPLQueryString("@timestamp", "$timeTo", "$timeFrom", "search source = default_index | where `ad_hoc_filter` = 'ad_hoc_filter_value'")
	pr, err := b.Build()
	assert.NoError(t, err)
	assert.Equal(t, "search source = default_index | where `@timestamp` >= '$timeFrom' and `@timestamp` <= '$timeTo' | where `ad_hoc_filter` = 'ad_hoc_filter_value'", pr.Query)
}
