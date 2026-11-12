package client

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestSQLRequestTimeFilterInjection covers the cases where the time range filter
// is added to a query. The filter has to be placed in a valid position and the
// existing query must not be changed otherwise.
func TestSQLRequestTimeFilterInjection(t *testing.T) {
	timeField := "@timestamp"
	from := "2026-06-01T00:00:00.000Z"
	to := "2026-06-01T04:00:00.000Z"
	filter := "`@timestamp` >= '2026-06-01T00:00:00.000Z' AND `@timestamp` <= '2026-06-01T04:00:00.000Z'"

	tests := []struct {
		name  string
		query string
		want  string
	}{
		{
			name:  "query without a where clause",
			query: "SELECT * FROM logs",
			want:  "SELECT * FROM logs WHERE " + filter,
		},
		{
			name:  "query with an existing where clause",
			query: "SELECT * FROM logs WHERE status_code = 200",
			want:  "SELECT * FROM logs WHERE status_code = 200 AND " + filter,
		},
		{
			name:  "query with additional filters in the where clause",
			query: "SELECT * FROM logs WHERE status_code = 200 AND level = 'error'",
			want:  "SELECT * FROM logs WHERE status_code = 200 AND level = 'error' AND " + filter,
		},
		{
			name:  "query with a limit",
			query: "SELECT * FROM logs LIMIT 10",
			want:  "SELECT * FROM logs WHERE " + filter + " LIMIT 10",
		},
		{
			name:  "query with a group by",
			query: "SELECT service, COUNT(*) FROM logs GROUP BY service",
			want:  "SELECT service, COUNT(*) FROM logs WHERE " + filter + " GROUP BY service",
		},
		{
			name:  "query with an order by and a limit",
			query: "SELECT * FROM logs ORDER BY status_code LIMIT 5",
			want:  "SELECT * FROM logs WHERE " + filter + " ORDER BY status_code LIMIT 5",
		},
		{
			name:  "query with a where clause and a limit",
			query: "SELECT * FROM logs WHERE status_code = 200 LIMIT 5",
			want:  "SELECT * FROM logs WHERE status_code = 200 AND " + filter + " LIMIT 5",
		},
		{
			name:  "query with a backtick quoted index",
			query: "SELECT * FROM `my-index` LIMIT 10",
			want:  "SELECT * FROM `my-index` WHERE " + filter + " LIMIT 10",
		},
		{
			name:  "query with a double quoted index",
			query: `SELECT * FROM "my-index" WHERE status_code = 200`,
			want:  `SELECT * FROM "my-index" WHERE status_code = 200 AND ` + filter,
		},
		{
			name:  "query with a trailing semicolon",
			query: "SELECT * FROM logs LIMIT 10;",
			want:  "SELECT * FROM logs WHERE " + filter + " LIMIT 10",
		},
		{
			name:  "query with a table alias",
			query: "SELECT * FROM logs AS l",
			want:  "SELECT * FROM logs AS l WHERE " + filter,
		},
		{
			name:  "query with a table alias without as",
			query: "SELECT * FROM logs l",
			want:  "SELECT * FROM logs l WHERE " + filter,
		},
		{
			name:  "query with an index pattern",
			query: "SELECT * FROM logs-*",
			want:  "SELECT * FROM logs-* WHERE " + filter,
		},
		{
			name:  "query with a join",
			query: "SELECT * FROM logs JOIN traces ON logs.id = traces.id",
			want:  "SELECT * FROM logs JOIN traces ON logs.id = traces.id WHERE " + filter,
		},
		{
			name:  "query with a keyword inside a string literal",
			query: "SELECT * FROM logs WHERE message = 'please limit this'",
			want:  "SELECT * FROM logs WHERE message = 'please limit this' AND " + filter,
		},
		{
			name:  "query with a where keyword inside a string literal",
			query: "SELECT * FROM logs WHERE message = 'where are we'",
			want:  "SELECT * FROM logs WHERE message = 'where are we' AND " + filter,
		},
		{
			name:  "query with a group by keyword inside a string literal",
			query: "SELECT * FROM logs WHERE message = 'group by service'",
			want:  "SELECT * FROM logs WHERE message = 'group by service' AND " + filter,
		},
		{
			name:  "query with a like pattern",
			query: "SELECT * FROM logs WHERE message LIKE '%limit%'",
			want:  "SELECT * FROM logs WHERE message LIKE '%limit%' AND " + filter,
		},
		{
			name:  "query with a parenthesized condition",
			query: "SELECT * FROM logs WHERE (status_code = 200 OR status_code = 500)",
			want:  "SELECT * FROM logs WHERE (status_code = 200 OR status_code = 500) AND " + filter,
		},
		{
			name:  "query with an or condition",
			query: "SELECT a, b FROM logs WHERE a = 1 OR b = 2",
			want:  "SELECT a, b FROM logs WHERE (a = 1 OR b = 2) AND " + filter,
		},
		{
			name:  "query with an or condition and a parenthesized group",
			query: "SELECT a, b FROM logs WHERE a = 1 OR (b = 2 AND c = 3)",
			want:  "SELECT a, b FROM logs WHERE (a = 1 OR (b = 2 AND c = 3)) AND " + filter,
		},
		{
			name:  "query with an or condition and a parenthesized group and a trailing comment",
			query: "SELECT a, b FROM logs WHERE a = 1 OR (b = 2 AND c = 3) -- note",
			want:  "SELECT a, b FROM logs WHERE (a = 1 OR (b = 2 AND c = 3)) AND " + filter + " -- note",
		},
		{
			name:  "query with an or condition and a group by",
			query: "SELECT a, b FROM logs WHERE a = 1 OR b = 2 GROUP BY c",
			want:  "SELECT a, b FROM logs WHERE (a = 1 OR b = 2) AND " + filter + " GROUP BY c",
		},
		{
			name:  "query with a from inside a function",
			query: "SELECT EXTRACT(YEAR FROM @timestamp) FROM logs",
			want:  "SELECT EXTRACT(YEAR FROM @timestamp) FROM logs WHERE " + filter,
		},
		{
			name:  "query with a limit keyword inside a string literal",
			query: "SELECT message FROM logs WHERE message = 'limit reached'",
			want:  "SELECT message FROM logs WHERE message = 'limit reached' AND " + filter,
		},
		{
			name:  "query with a from keyword inside a string literal",
			query: "SELECT message FROM logs WHERE message = 'selected from the logs'",
			want:  "SELECT message FROM logs WHERE message = 'selected from the logs' AND " + filter,
		},
		{
			name:  "query with a union",
			query: "SELECT * FROM logs UNION SELECT * FROM logs",
			want:  "SELECT * FROM logs WHERE " + filter + " UNION SELECT * FROM logs WHERE " + filter,
		},
		{
			name:  "query with a union all",
			query: "SELECT * FROM logs UNION ALL SELECT * FROM logs",
			want:  "SELECT * FROM logs WHERE " + filter + " UNION ALL SELECT * FROM logs WHERE " + filter,
		},
		{
			name:  "query with a common table expression",
			query: "WITH x AS (SELECT * FROM other) SELECT * FROM x",
			want:  "WITH x AS (SELECT * FROM other) SELECT * FROM x WHERE " + filter,
		},
		{
			name:  "query with a top level or condition",
			query: "SELECT * FROM logs WHERE level = 'error' OR level = 'warn'",
			want:  "SELECT * FROM logs WHERE (level = 'error' OR level = 'warn') AND " + filter,
		},
		{
			name:  "query with a subquery",
			query: "SELECT * FROM logs WHERE service IN (SELECT service FROM traces LIMIT 10)",
			want:  "SELECT * FROM logs WHERE service IN (SELECT service FROM traces LIMIT 10) AND " + filter,
		},
		{
			name:  "query with a derived table",
			query: "SELECT service FROM (SELECT service FROM logs) t",
			want:  "SELECT service FROM (SELECT service FROM logs WHERE " + filter + ") t",
		},
		{
			name:  "query with a derived table and an alias keyword",
			query: "SELECT service FROM (SELECT service FROM logs) AS t",
			want:  "SELECT service FROM (SELECT service FROM logs WHERE " + filter + ") AS t",
		},
		{
			name:  "query with a derived table and an outer where clause",
			query: "SELECT * FROM (SELECT * FROM logs) t WHERE level = 'error'",
			want:  "SELECT * FROM (SELECT * FROM logs WHERE " + filter + ") t WHERE level = 'error'",
		},
		{
			name:  "query with a derived table without an alias",
			query: "SELECT cnt FROM (SELECT COUNT(*) AS cnt FROM logs) GROUP BY cnt",
			want:  "SELECT cnt FROM (SELECT COUNT(*) AS cnt FROM logs WHERE " + filter + ") GROUP BY cnt",
		},
		{
			name:  "query with a derived table that has a where clause",
			query: "SELECT * FROM (SELECT * FROM logs WHERE level = 'error') t",
			want:  "SELECT * FROM (SELECT * FROM logs WHERE level = 'error' AND " + filter + ") t",
		},
		{
			name:  "query that joins a derived table",
			query: "SELECT s.service FROM (SELECT service FROM logs) s JOIN traces x ON s.service = x.serviceName",
			want:  "SELECT s.service FROM (SELECT service FROM logs) s JOIN traces x ON s.service = x.serviceName WHERE " + filter,
		},
		{
			name:  "query that joins two derived tables",
			query: "SELECT * FROM (SELECT * FROM a) t, (SELECT * FROM b) u",
			want:  "SELECT * FROM (SELECT * FROM a) t, (SELECT * FROM b) u WHERE " + filter,
		},
		{
			name:  "query with a nested field",
			query: "SELECT * FROM logs WHERE nested.field = 1",
			want:  "SELECT * FROM logs WHERE nested.field = 1 AND " + filter,
		},
		{
			name:  "query with an in list",
			query: "SELECT * FROM logs WHERE level IN ('error', 'warn')",
			want:  "SELECT * FROM logs WHERE level IN ('error', 'warn') AND " + filter,
		},
		{
			name:  "query without a from clause is left alone",
			query: "SELECT timestamp('now')",
			want:  "SELECT timestamp('now')",
		},
		{
			name:  "query with a trailing line comment",
			query: "SELECT * FROM logs WHERE status_code = 200 -- only errors",
			want:  "SELECT * FROM logs WHERE status_code = 200 AND " + filter + " -- only errors",
		},
		{
			name:  "query with a trailing block comment",
			query: "SELECT * FROM logs WHERE status_code = 200 /* only errors */",
			want:  "SELECT * FROM logs WHERE status_code = 200 /* only errors */ AND " + filter,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := NewSQLRequestBuilder("logs", timeField)
			b.AddSQLQueryString(timeField, to, from, tt.query)

			sr, err := b.Build()
			assert.NoError(t, err)
			assert.Equal(t, tt.want, sr.Query)
		})
	}
}

// TestSQLRequestTimeFilterInjectionIsValidSQL checks that the generated query
// has a single WHERE clause and that the filter is part of it, which is what
// makes the difference between a working query and one that OpenSearch rejects.
func TestSQLRequestTimeFilterInjectionIsValidSQL(t *testing.T) {
	queries := []string{
		"SELECT * FROM logs",
		"SELECT * FROM logs WHERE status_code = 200",
		"SELECT * FROM logs WHERE status_code = 200 AND level = 'error'",
		`SELECT * FROM "my-index" WHERE status_code = 200`,
		"SELECT * FROM logs AS l",
		"SELECT * FROM logs-*",
		"SELECT * FROM logs WHERE message = 'limit this'",
		"SELECT * FROM logs WHERE level = 'error' OR level = 'warn'",
		"SELECT * FROM logs WHERE service IN (SELECT service FROM traces LIMIT 10)",
		"SELECT * FROM logs JOIN traces ON logs.id = traces.id",
		"SELECT * FROM logs WHERE a = 1 OR (b = 2 AND c = 3)",
	}

	for _, query := range queries {
		t.Run(query, func(t *testing.T) {
			b := NewSQLRequestBuilder("logs", "@timestamp")
			b.AddSQLQueryString("@timestamp", "to", "from", query)

			tokens, _, _ := tokenizeSQL(b.sqlQuery)
			whereCount := 0
			for _, tok := range tokens {
				if tok.kind == sqlTokenWord && tok.depth == 0 && tok.text == "WHERE" {
					whereCount++
				}
			}
			assert.Equal(t, 1, whereCount, "the query must have exactly one WHERE clause")
		})
	}
}

// TestSQLRequestTimeFilterInjectionBalancesParentheses checks that the
// parentheses of a grouped condition are balanced in the generated query. An
// unbalanced query is rejected by OpenSearch, and the rows that are returned
// without the filter are outside of the selected time range.
func TestSQLRequestTimeFilterInjectionBalancesParentheses(t *testing.T) {
	queries := []string{
		"SELECT * FROM logs WHERE a = 1 OR (b = 2 AND c = 3)",
		"SELECT * FROM logs WHERE a = 1 OR (b = 2 OR c = 3)",
		"SELECT * FROM logs WHERE (a = 1) OR b = 2",
		"SELECT * FROM logs WHERE a = 1 AND (b = 2 OR c = 3)",
		"SELECT * FROM logs WHERE a = 1 OR (b = 2) -- note",
	}

	for _, query := range queries {
		t.Run(query, func(t *testing.T) {
			b := NewSQLRequestBuilder("logs", "@timestamp")
			b.AddSQLQueryString("@timestamp", "to", "from", query)

			assert.Equal(t, strings.Count(b.sqlQuery, "("), strings.Count(b.sqlQuery, ")"),
				"the parentheses of the query must be balanced")
		})
	}
}

// TestSQLRequestTimeFieldIsQuoted covers the quoting of the time field. A name
// such as @timestamp is rejected by the engine as soon as the query reads from
// more than one source, which happens in a join, in a query with an IN subquery
// and in a query over a nested collection. Quoting the name keeps those queries
// working.
func TestSQLRequestTimeFieldIsQuoted(t *testing.T) {
	from := "2026-06-01T00:00:00.000Z"
	to := "2026-06-01T04:00:00.000Z"

	tests := []struct {
		name      string
		timeField string
		query     string
		want      string
	}{
		{
			name:      "a plain time field is quoted as well",
			timeField: "timestamp",
			query:     "SELECT * FROM logs",
			want:      "SELECT * FROM logs WHERE `timestamp` >= '2026-06-01T00:00:00.000Z' AND `timestamp` <= '2026-06-01T04:00:00.000Z'",
		},
		{
			name:      "a time field that is already quoted is not quoted twice",
			timeField: "`@timestamp`",
			query:     "SELECT * FROM logs",
			want:      "SELECT * FROM logs WHERE `@timestamp` >= '2026-06-01T00:00:00.000Z' AND `@timestamp` <= '2026-06-01T04:00:00.000Z'",
		},
		{
			name:      "a time field that is already double quoted is not quoted twice",
			timeField: "\"@timestamp\"",
			query:     "SELECT * FROM logs",
			want:      "SELECT * FROM logs WHERE \"@timestamp\" >= '2026-06-01T00:00:00.000Z' AND \"@timestamp\" <= '2026-06-01T04:00:00.000Z'",
		},
		{
			name:      "the time field is not added to a query without a from clause",
			timeField: "@timestamp",
			query:     "SELECT 1",
			want:      "SELECT 1",
		},
		{
			name:      "an empty query falls back to selecting the index",
			timeField: "@timestamp",
			query:     "",
			want:      "SELECT * FROM default_index WHERE `@timestamp` >= '2026-06-01T00:00:00.000Z' AND `@timestamp` <= '2026-06-01T04:00:00.000Z'",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := NewSQLRequestBuilder("default_index", tt.timeField)
			b.AddSQLQueryString(tt.timeField, to, from, tt.query)

			assert.Equal(t, tt.want, b.sqlQuery)
		})
	}
}
