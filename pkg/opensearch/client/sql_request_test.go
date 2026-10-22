package client

import (
	"encoding/json"
	"testing"

	"github.com/bitly/go-simplejson"
	"github.com/stretchr/testify/assert"
)

func TestSQLRequest(t *testing.T) {
	t.Run("Test OpenSearch SQL request", func(t *testing.T) {
		timeField := "@timestamp"
		index := "default_index"
		t.Run("Given new SQL request builder", func(t *testing.T) {
			b := NewSQLRequestBuilder(index, timeField)

			t.Run("When building SQL request", func(t *testing.T) {
				sr, err := b.Build()
				assert.NoError(t, err)

				t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
					body, err := json.Marshal(sr)
					assert.NoError(t, err)
					json, err := simplejson.NewJson(body)
					assert.NoError(t, err)
					assert.Equal(t, "", json.Get("query").Interface())
				})
			})

			t.Run("When adding default query", func(t *testing.T) {
				b.AddSQLQueryString(timeField, "$timeTo", "$timeFrom", "")

				t.Run("When building SQL request", func(t *testing.T) {
					sr, err := b.Build()
					assert.NoError(t, err)

					t.Run("Should have query string filter", func(t *testing.T) {
						assert.Equal(
							t,
							"SELECT * FROM default_index WHERE @timestamp >= '$timeFrom' AND @timestamp <= '$timeTo'",
							sr.Query,
						)
					})

					t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
						body, err := json.Marshal(sr)
						assert.NoError(t, err)
						json, err := simplejson.NewJson(body)
						assert.NoError(t, err)
						assert.Equal(t, "SELECT * FROM default_index WHERE @timestamp >= '$timeFrom' AND @timestamp <= '$timeTo'", json.Get("query").Interface())
					})
				})
			})
			t.Run("When adding SQL query", func(t *testing.T) {
				b.AddSQLQueryString(timeField, "$timeTo", "$timeFrom", "SELECT status_code FROM default_index LIMIT 10")

				t.Run("When building SQL request", func(t *testing.T) {
					sr, err := b.Build()
					assert.NoError(t, err)

					t.Run("Should have query string filter", func(t *testing.T) {
						assert.Equal(
							t,
							"SELECT status_code FROM default_index WHERE @timestamp >= '$timeFrom' AND @timestamp <= '$timeTo' LIMIT 10",
							sr.Query,
						)
					})

					t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
						body, err := json.Marshal(sr)
						assert.NoError(t, err)
						json, err := simplejson.NewJson(body)
						assert.NoError(t, err)
						assert.Equal(t, "SELECT status_code FROM default_index WHERE @timestamp >= '$timeFrom' AND @timestamp <= '$timeTo' LIMIT 10", json.Get("query").Interface())
					})
				})
			})
			t.Run("When adding SQL query with existing WHERE clause", func(t *testing.T) {
				b.AddSQLQueryString(timeField, "$timeTo", "$timeFrom", "SELECT status_code FROM default_index WHERE status_code = 200")

				t.Run("When building SQL request", func(t *testing.T) {
					sr, err := b.Build()
					assert.NoError(t, err)

					t.Run("Should append AND to existing WHERE clause", func(t *testing.T) {
						assert.Equal(
							t,
							"SELECT status_code FROM default_index WHERE status_code = 200 AND @timestamp >= '$timeFrom' AND @timestamp <= '$timeTo'",
							sr.Query,
						)
					})
				})
			})
			t.Run("When adding SQL query with existing WHERE clause and LIMIT", func(t *testing.T) {
				b.AddSQLQueryString(timeField, "$timeTo", "$timeFrom", "SELECT status_code FROM default_index WHERE status_code = 200 LIMIT 5")

				t.Run("When building SQL request", func(t *testing.T) {
					sr, err := b.Build()
					assert.NoError(t, err)

					t.Run("Should insert the filter into the WHERE clause before LIMIT", func(t *testing.T) {
						assert.Equal(
							t,
							"SELECT status_code FROM default_index WHERE status_code = 200 AND @timestamp >= '$timeFrom' AND @timestamp <= '$timeTo' LIMIT 5",
							sr.Query,
						)
					})
				})
			})
			t.Run("When adding SQL query with GROUP BY", func(t *testing.T) {
				b.AddSQLQueryString(timeField, "$timeTo", "$timeFrom", "SELECT service, count(*) FROM default_index GROUP BY service")

				t.Run("When building SQL request", func(t *testing.T) {
					sr, err := b.Build()
					assert.NoError(t, err)

					t.Run("Should insert the filter before GROUP BY", func(t *testing.T) {
						assert.Equal(
							t,
							"SELECT service, count(*) FROM default_index WHERE @timestamp >= '$timeFrom' AND @timestamp <= '$timeTo' GROUP BY service",
							sr.Query,
						)
					})
				})
			})
			t.Run("When adding SQL query with ORDER BY and LIMIT", func(t *testing.T) {
				b.AddSQLQueryString(timeField, "$timeTo", "$timeFrom", "SELECT status_code FROM default_index ORDER BY status_code LIMIT 5")

				t.Run("When building SQL request", func(t *testing.T) {
					sr, err := b.Build()
					assert.NoError(t, err)

					t.Run("Should insert the filter before ORDER BY", func(t *testing.T) {
						assert.Equal(
							t,
							"SELECT status_code FROM default_index WHERE @timestamp >= '$timeFrom' AND @timestamp <= '$timeTo' ORDER BY status_code LIMIT 5",
							sr.Query,
						)
					})
				})
			})
			t.Run("When adding SQL query with backtick-quoted index", func(t *testing.T) {
				b.AddSQLQueryString(timeField, "$timeTo", "$timeFrom", "SELECT * FROM `my-index` LIMIT 10")

				t.Run("When building SQL request", func(t *testing.T) {
					sr, err := b.Build()
					assert.NoError(t, err)

					t.Run("Should insert the filter after the quoted table name", func(t *testing.T) {
						assert.Equal(
							t,
							"SELECT * FROM `my-index` WHERE @timestamp >= '$timeFrom' AND @timestamp <= '$timeTo' LIMIT 10",
							sr.Query,
						)
					})
				})
			})
			t.Run("When adding SQL query with trailing semicolon", func(t *testing.T) {
				b.AddSQLQueryString(timeField, "$timeTo", "$timeFrom", "SELECT status_code FROM default_index LIMIT 10;")

				t.Run("When building SQL request", func(t *testing.T) {
					sr, err := b.Build()
					assert.NoError(t, err)

					t.Run("Should strip trailing semicolon before injecting filter", func(t *testing.T) {
						assert.Equal(
							t,
							"SELECT status_code FROM default_index WHERE @timestamp >= '$timeFrom' AND @timestamp <= '$timeTo' LIMIT 10",
							sr.Query,
						)
					})
				})
			})
		})
	})
}

func TestSQLRequestMarshal(t *testing.T) {
	sr := &SQLRequest{Query: "SELECT 1"}
	body, err := json.Marshal(sr)
	assert.NoError(t, err)
	json, err := simplejson.NewJson(body)
	assert.NoError(t, err)
	assert.Equal(t, "SELECT 1", json.Get("query").Interface())
}
