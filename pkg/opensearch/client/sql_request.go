package client

import (
	"fmt"
	"regexp"
	"strings"
)

// SQLRequestBuilder represents a SQL request builder
type SQLRequestBuilder struct {
	index     string
	timeField string
	sqlQuery  string
}

// The regular expressions below locate the clauses a time-range WHERE filter must sit between.
// In SQL the WHERE clause belongs immediately after the FROM table and before GROUP BY /
// ORDER BY / LIMIT, so the filter is injected at the earliest of those boundaries.
var (
	// fromClauseRegex captures the table name that follows FROM (backtick-quoted or plain).
	fromClauseRegex = regexp.MustCompile(`(?i)\bfrom\s+(` + "`" + `[^` + "`" + `]+` + "`" + `|[\w.-]+)`)
	groupByRegex    = regexp.MustCompile(`(?i)\bgroup\s+by\b`)
	orderByRegex    = regexp.MustCompile(`(?i)\border\s+by\b`)
	limitRegex      = regexp.MustCompile(`(?i)\blimit\b`)
	whereRegex      = regexp.MustCompile(`(?i)\bwhere\b`)
)

// NewSQLRequestBuilder creates a new SQL request builder
func NewSQLRequestBuilder(index, timeField string) *SQLRequestBuilder {
	builder := &SQLRequestBuilder{
		index:     index,
		timeField: timeField,
	}
	return builder
}

// Build builds and returns a SQL query object
func (b *SQLRequestBuilder) Build() (*SQLRequest, error) {
	return &SQLRequest{
		Query: b.sqlQuery,
	}, nil
}

// SetSQLQuery sets the raw SQL query string
func (b *SQLRequestBuilder) SetSQLQuery(query string) *SQLRequestBuilder {
	b.sqlQuery = strings.TrimSpace(query)
	// A trailing semicolon is not needed for the SQL API and is stripped so the
	// injected time-range filter can be appended cleanly.
	b.sqlQuery = strings.TrimRight(b.sqlQuery, "; \t")
	return b
}

// AddSQLQueryString adds a SQL query string with a time range filter applied.
// The filter is injected as a WHERE (or additional AND) clause on the configured
// time field so that every query respects the selected time range. The WHERE clause
// is placed right after the FROM table and before any GROUP BY / ORDER BY / LIMIT
// clause, which keeps the result valid SQL (a WHERE after LIMIT would not be).
func (b *SQLRequestBuilder) AddSQLQueryString(timeField, to, from, querystring string) *SQLRequestBuilder {
	timeFilter := fmt.Sprintf("%s >= '%s' AND %s <= '%s'", timeField, from, timeField, to)

	query := strings.TrimSpace(querystring)
	query = strings.TrimRight(query, "; \t")

	// If the query is empty, fall back to selecting everything from the index.
	if query == "" {
		query = fmt.Sprintf("SELECT * FROM %s", b.index)
	}

	// The WHERE clause belongs immediately after the FROM table name.
	insertAt := len(query)
	if m := fromClauseRegex.FindStringSubmatchIndex(query); m != nil {
		insertAt = m[3] // end offset of the captured table name
	}

	// It must precede GROUP BY / ORDER BY / LIMIT, so pull the insertion point back to
	// the earliest of those clause boundaries if they appear before it.
	bound := len(query)
	for _, re := range []*regexp.Regexp{groupByRegex, orderByRegex, limitRegex} {
		if m := re.FindStringIndex(query); m != nil && m[0] < bound {
			bound = m[0]
		}
	}

	connector := " WHERE"
	if wm := whereRegex.FindStringIndex(query); wm != nil && wm[0] > insertAt && wm[0] < bound {
		// A WHERE already exists in the valid region: extend it with AND at the end of the
		// clause (just before GROUP BY / ORDER BY / LIMIT, or end of query) rather than
		// opening a second WHERE right after the keyword.
		connector = " AND"
		insertAt = bound
	} else if insertAt > bound {
		insertAt = bound
	}

	// Normalize the whitespace around the insertion point so a clause boundary that already
	// has surrounding spaces does not end up with a double space or a missing one.
	prefix := strings.TrimRight(query[:insertAt], " \t")
	suffix := strings.TrimLeft(query[insertAt:], " \t")
	result := prefix + connector + " " + timeFilter
	if suffix != "" {
		result += " " + suffix
	}

	b.sqlQuery = result
	return b
}
