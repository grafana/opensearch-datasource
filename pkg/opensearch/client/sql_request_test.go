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
							"SELECT * FROM default_index WHERE `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo'",
							sr.Query,
						)
					})

					t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
						body, err := json.Marshal(sr)
						assert.NoError(t, err)
						json, err := simplejson.NewJson(body)
						assert.NoError(t, err)
						assert.Equal(t, "SELECT * FROM default_index WHERE `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo'", json.Get("query").Interface())
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
							"SELECT status_code FROM default_index WHERE `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo' LIMIT 10",
							sr.Query,
						)
					})

					t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
						body, err := json.Marshal(sr)
						assert.NoError(t, err)
						json, err := simplejson.NewJson(body)
						assert.NoError(t, err)
						assert.Equal(t, "SELECT status_code FROM default_index WHERE `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo' LIMIT 10", json.Get("query").Interface())
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
							"SELECT status_code FROM default_index WHERE status_code = 200 AND `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo'",
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
							"SELECT status_code FROM default_index WHERE status_code = 200 AND `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo' LIMIT 5",
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
							"SELECT service, count(*) FROM default_index WHERE `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo' GROUP BY service",
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
							"SELECT status_code FROM default_index WHERE `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo' ORDER BY status_code LIMIT 5",
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
							"SELECT * FROM `my-index` WHERE `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo' LIMIT 10",
							sr.Query,
						)
					})
				})
			})
			t.Run("When adding SQL query with a trailing semicolon followed by a comment", func(t *testing.T) {
				tests := []struct {
					name     string
					query    string
					expected string
				}{
					{
						name:     "line comment",
						query:    "SELECT status_code FROM default_index LIMIT 10; -- done",
						expected: "SELECT status_code FROM default_index WHERE `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo' LIMIT 10 -- done",
					},
					{
						name:     "line comment on its own line",
						query:    "SELECT status_code FROM default_index LIMIT 10;\n-- done",
						expected: "SELECT status_code FROM default_index WHERE `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo' LIMIT 10\n-- done",
					},
					{
						name:     "block comment",
						query:    "SELECT status_code FROM default_index LIMIT 10; /* done */",
						expected: "SELECT status_code FROM default_index WHERE `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo' LIMIT 10 /* done */",
					},
					{
						name:     "hash comment",
						query:    "SELECT status_code FROM default_index LIMIT 10; # done",
						expected: "SELECT status_code FROM default_index WHERE `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo' LIMIT 10 # done",
					},
				}

				for _, tt := range tests {
					t.Run(tt.name, func(t *testing.T) {
						b := NewSQLRequestBuilder("default_index", timeField)
						b.AddSQLQueryString(timeField, "$timeTo", "$timeFrom", tt.query)

						sr, err := b.Build()
						assert.NoError(t, err)
						assert.Equal(t, tt.expected, sr.Query)
					})
				}
			})

			t.Run("When adding SQL query whose semicolon is inside a comment", func(t *testing.T) {
				b.AddSQLQueryString(timeField, "$timeTo", "$timeFrom", "SELECT status_code FROM default_index LIMIT 10 -- done;")

				sr, err := b.Build()
				assert.NoError(t, err)
				assert.Equal(
					t,
					"SELECT status_code FROM default_index WHERE `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo' LIMIT 10 -- done;",
					sr.Query,
				)
			})

			t.Run("When adding SQL query with trailing semicolon", func(t *testing.T) {
				b.AddSQLQueryString(timeField, "$timeTo", "$timeFrom", "SELECT status_code FROM default_index LIMIT 10;")

				t.Run("When building SQL request", func(t *testing.T) {
					sr, err := b.Build()
					assert.NoError(t, err)

					t.Run("Should strip trailing semicolon before injecting filter", func(t *testing.T) {
						assert.Equal(
							t,
							"SELECT status_code FROM default_index WHERE `@timestamp` >= '$timeFrom' AND `@timestamp` <= '$timeTo' LIMIT 10",
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

// A query whose comment or literal is never closed must not be sent. The scan
// cannot tell where such a query ends, so the time filter would be inserted
// inside the comment or the literal and lost, and the query would return data
// outside of the selected time range without any warning.
func TestSQLRequestRefusesUnterminatedQuery(t *testing.T) {
	timeField := "@timestamp"

	tests := []struct {
		name  string
		query string
	}{
		{name: "unterminated block comment", query: "SELECT COUNT(*) FROM default_index /* oops"},
		{name: "unterminated string literal", query: "SELECT COUNT(*) FROM default_index WHERE message = 'oops"},
		{name: "unterminated quoted identifier", query: "SELECT COUNT(*) FROM `default_index"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := NewSQLRequestBuilder("default_index", timeField)
			b.AddSQLQueryString(timeField, "$timeTo", "$timeFrom", tt.query)

			sr, err := b.Build()

			assert.Error(t, err)
			assert.Nil(t, sr, "a query that cannot be filtered must not be sent at all")
		})
	}
}

// A query that is terminated correctly must still be filtered, so that the
// check above does not reject valid queries.
func TestSQLRequestAcceptsTerminatedQuery(t *testing.T) {
	timeField := "@timestamp"

	t.Run("a closed block comment", func(t *testing.T) {
		b := NewSQLRequestBuilder("default_index", timeField)
		b.AddSQLQueryString(timeField, "$timeTo", "$timeFrom", "SELECT COUNT(*) FROM default_index /* done */")

		sr, err := b.Build()
		assert.NoError(t, err)
		assert.Contains(t, sr.Query, "WHERE `@timestamp` >= '$timeFrom'")
	})

	t.Run("a query without a comment", func(t *testing.T) {
		b := NewSQLRequestBuilder("default_index", timeField)
		b.AddSQLQueryString(timeField, "$timeTo", "$timeFrom", "SELECT COUNT(*) FROM default_index WHERE status = 200")

		sr, err := b.Build()
		assert.NoError(t, err)
		assert.Contains(t, sr.Query, "AND `@timestamp` >= '$timeFrom'")
	})
}
