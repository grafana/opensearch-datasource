package client

import (
	"errors"
	"fmt"
	"strings"
)

// SQLRequestBuilder represents a SQL request builder
type SQLRequestBuilder struct {
	index     string
	timeField string
	sqlQuery  string
	// buildErr is set when the query cannot be built as asked, so that Build
	// reports the problem to the caller instead of sending a query that would
	// return the wrong data.
	buildErr error
}

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
	if b.buildErr != nil {
		return nil, b.buildErr
	}
	return &SQLRequest{
		Query: b.sqlQuery,
	}, nil
}

// SetSQLQuery sets the raw SQL query string
func (b *SQLRequestBuilder) SetSQLQuery(query string) *SQLRequestBuilder {
	// A trailing semicolon is not needed for the SQL API and is stripped so the
	// injected time-range filter can be appended cleanly.
	b.sqlQuery = normalizeSQLQuery(query)
	return b
}

// normalizeSQLQuery trims a query and removes the semicolon that terminates it,
// which the SQL API does not need. The semicolon is found on the tokens and not
// with TrimRight, because TrimRight only removes characters at the very end of
// the string and leaves the semicolon in place when a comment follows it. A
// query such as `SELECT * FROM index; -- done` would otherwise keep its
// semicolon and have the time filter appended after the comment, which the
// engine rejects with `no such index [index;]`.
func normalizeSQLQuery(query string) string {
	query = strings.TrimSpace(query)

	for {
		tokens, _, _ := tokenizeSQL(query)
		if len(tokens) == 0 {
			break
		}
		last := tokens[len(tokens)-1]
		if last.depth != 0 || !isPunctuation(last, ";") {
			break
		}
		query = query[:last.start] + query[last.end:]
	}

	return strings.TrimSpace(query)
}

// AddSQLQueryString adds a SQL query string with a time range filter applied.
// The filter is injected as a WHERE (or additional AND) clause on the configured
// time field so that every query respects the selected time range.
func (b *SQLRequestBuilder) AddSQLQueryString(timeField, to, from, querystring string) *SQLRequestBuilder {
	// The time field is quoted because a name such as @timestamp is rejected as
	// soon as the query reads from more than one source, which happens in a join,
	// in a query with an IN subquery and in a query over a nested collection.
	quotedTimeField := quoteIdentifier(timeField)
	timeFilter := fmt.Sprintf("%s >= '%s' AND %s <= '%s'", quotedTimeField, from, quotedTimeField, to)

	query := normalizeSQLQuery(querystring)

	// If the query is empty, fall back to selecting everything from the index.
	if query == "" {
		query = fmt.Sprintf("SELECT * FROM %s", b.index)
	}

	// A query with an unterminated comment or literal cannot be filtered: the
	// scan cannot tell where the statement ends, so the text of the filter would
	// be inserted inside the comment or the literal and lost, leaving the query
	// without a time range. Reporting an error is the only way to keep the
	// selected time range from being dropped without a word.
	if _, _, err := tokenizeSQL(query); err != nil {
		b.buildErr = fmt.Errorf("cannot apply the time range to the query: %w", err)
		return b
	}

	b.sqlQuery = injectTimeFilter(query, timeFilter)
	return b
}

// quoteIdentifier quotes a field name so that the engine reads it as a name and
// not as an expression. Names that are already quoted are returned unchanged.
func quoteIdentifier(name string) string {
	if name == "" {
		return name
	}
	if strings.HasPrefix(name, "`") && strings.HasSuffix(name, "`") {
		return name
	}
	if strings.HasPrefix(name, "\"") && strings.HasSuffix(name, "\"") {
		return name
	}
	return "`" + name + "`"
}

// sqlTokenKind classifies the tokens produced by tokenizeSQL.
type sqlTokenKind int

const (
	sqlTokenWord sqlTokenKind = iota
	sqlTokenNumber
	sqlTokenString
	sqlTokenQuotedIdentifier
	sqlTokenPunctuation
)

// sqlToken is a single lexical token of a SQL query. The offsets refer to the
// original query, so a token can be located in the text it came from.
type sqlToken struct {
	kind  sqlTokenKind
	text  string
	start int
	end   int
	// depth is the parenthesis nesting level the token sits at. Tokens inside a
	// subquery or a parenthesized expression have a depth greater than zero.
	depth int
}

// sqlComment is a comment found while tokenizing a SQL query.
type sqlComment struct {
	start int
	end   int
	// line is true for `--` and `#` comments, which run to the end of the line.
	line bool
}

// clauseKeywords are the keywords that start a clause following the WHERE
// clause. The time filter has to be inserted before the first of them.
var clauseKeywords = map[string]bool{
	"GROUP":     true,
	"HAVING":    true,
	"ORDER":     true,
	"LIMIT":     true,
	"OFFSET":    true,
	"UNION":     true,
	"EXCEPT":    true,
	"INTERSECT": true,
	"WINDOW":    true,
	"FETCH":     true,
}

// tokenizeSQL splits a SQL query into lexical tokens. String literals, quoted
// identifiers and comments are recognized so that keywords inside them are not
// mistaken for clause boundaries, and the parenthesis nesting level is tracked
// so that clauses of a subquery are ignored.
func tokenizeSQL(query string) ([]sqlToken, []sqlComment, error) {
	var tokens []sqlToken
	var comments []sqlComment
	var err error

	depth := 0
	i := 0
	n := len(query)

	for i < n {
		c := query[i]

		switch {
		case c == ' ' || c == '\t' || c == '\n' || c == '\r':
			i++

		case c == '-' && i+1 < n && query[i+1] == '-':
			start := i
			for i < n && query[i] != '\n' {
				i++
			}
			comments = append(comments, sqlComment{start: start, end: i, line: true})

		case c == '#':
			start := i
			for i < n && query[i] != '\n' {
				i++
			}
			comments = append(comments, sqlComment{start: start, end: i, line: true})

		case c == '/' && i+1 < n && query[i+1] == '*':
			start := i
			i += 2
			for i < n && !(query[i] == '*' && i+1 < n && query[i+1] == '/') {
				i++
			}
			// A block comment that is never closed runs to the end of the query.
			// It is reported, because an offset that falls inside it would be
			// swallowed by it and the text inserted there would be lost.
			if i+1 >= n {
				i = n
				err = errors.New("unterminated block comment")
			} else {
				i += 2
			}
			comments = append(comments, sqlComment{start: start, end: i})

		case c == '\'':
			start := i
			i++
			for i < n {
				if query[i] == '\\' && i+1 < n {
					i += 2
					continue
				}
				if query[i] == '\'' {
					// A doubled quote is an escaped quote, not the end of the literal.
					if i+1 < n && query[i+1] == '\'' {
						i += 2
						continue
					}
					i++
					break
				}
				i++
			}
			// A literal that never closes runs to the end of the query, so an
			// insertion after it would be swallowed by it.
			if start == i-1 || query[i-1] != '\'' {
				err = errors.New("unterminated string literal")
			}
			tokens = append(tokens, sqlToken{kind: sqlTokenString, text: query[start:i], start: start, end: i, depth: depth})

		case c == '"' || c == '`':
			quote := c
			start := i
			i++
			for i < n {
				if query[i] == quote {
					// A doubled quote is an escaped quote, not the end of the identifier.
					if i+1 < n && query[i+1] == quote {
						i += 2
						continue
					}
					i++
					break
				}
				i++
			}
			// A quoted identifier that never closes runs to the end as well.
			if start == i-1 || query[i-1] != quote {
				err = errors.New("unterminated quoted identifier")
			}
			tokens = append(tokens, sqlToken{kind: sqlTokenQuotedIdentifier, text: query[start:i], start: start, end: i, depth: depth})

		case isSQLIdentStart(c):
			start := i
			for i < n && isSQLIdentChar(query[i]) {
				i++
			}
			tokens = append(tokens, sqlToken{kind: sqlTokenWord, text: query[start:i], start: start, end: i, depth: depth})

		case c >= '0' && c <= '9':
			start := i
			for i < n && (query[i] >= '0' && query[i] <= '9' || query[i] == '.') {
				i++
			}
			tokens = append(tokens, sqlToken{kind: sqlTokenNumber, text: query[start:i], start: start, end: i, depth: depth})

		case c == '(':
			tokens = append(tokens, sqlToken{kind: sqlTokenPunctuation, text: "(", start: i, end: i + 1, depth: depth})
			i++
			depth++

		case c == ')':
			if depth > 0 {
				depth--
			}
			tokens = append(tokens, sqlToken{kind: sqlTokenPunctuation, text: ")", start: i, end: i + 1, depth: depth})
			i++

		default:
			tokens = append(tokens, sqlToken{kind: sqlTokenPunctuation, text: string(c), start: i, end: i + 1, depth: depth})
			i++
		}
	}

	return tokens, comments, err
}

func isSQLIdentStart(c byte) bool {
	return c == '_' || c == '$' || c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z'
}

func isSQLIdentChar(c byte) bool {
	return isSQLIdentStart(c) || c >= '0' && c <= '9'
}

// injectTimeFilter adds the time range filter to a SQL query.
//
// The filter is added as a WHERE clause when the query has none, and extended
// with AND when it has one. The insertion point is derived from a tokenized view
// of the query, so keywords inside string literals, quoted identifiers or
// comments are not mistaken for clause boundaries and clauses of a subquery are
// ignored.
func injectTimeFilter(query, timeFilter string) string {
	tokens, comments, _ := tokenizeSQL(query)

	// A set operation combines the results of several queries, so every branch
	// has to be filtered on its own. The branches are handled separately and
	// joined again afterwards.
	if branches := splitSetOperationBranches(query, tokens); len(branches) > 1 {
		parts := make([]string, 0, len(branches))
		for _, branch := range branches {
			if branch.separator != "" {
				parts = append(parts, branch.separator)
				continue
			}
			parts = append(parts, injectTimeFilter(branch.query, timeFilter))
		}
		return strings.Join(parts, " ")
	}

	fromIdx := -1
	whereIdx := -1
	for i, tok := range tokens {
		if tok.kind != sqlTokenWord || tok.depth != 0 {
			continue
		}
		switch strings.ToUpper(tok.text) {
		case "FROM":
			if fromIdx == -1 {
				fromIdx = i
			}
		case "WHERE":
			if fromIdx != -1 && whereIdx == -1 {
				whereIdx = i
			}
		}
		if whereIdx != -1 {
			break
		}
	}

	// Without a FROM clause there is no table the filter could be applied to.
	if fromIdx == -1 {
		return query
	}

	// A derived table hides the fields of the index it reads from, so the filter
	// has to be added to the subquery. Added to the outer query it would refer to
	// a field that is not part of the derived table, which the engine rejects.
	if start, end, ok := derivedTableRange(tokens, fromIdx); ok {
		inner := injectTimeFilter(query[start:end], timeFilter)
		return query[:start] + inner + query[end:]
	}

	if whereIdx != -1 {
		return extendWhereClause(query, tokens, comments, whereIdx, timeFilter)
	}
	return insertWhereClause(query, tokens, comments, fromIdx, timeFilter)
}

// joinKeywords are the keywords that start a join, which makes the FROM clause
// read from more than one source.
var joinKeywords = map[string]bool{
	"JOIN":          true,
	"INNER":         true,
	"LEFT":          true,
	"RIGHT":         true,
	"FULL":          true,
	"CROSS":         true,
	"NATURAL":       true,
	"STRAIGHT_JOIN": true,
	"ON":            true,
	"USING":         true,
}

// derivedTableRange returns the offsets of the subquery of a derived table when
// the FROM clause reads from exactly one source and that source is a derived
// table. A FROM clause that joins a derived table with another source is left
// alone, because it is not clear which of the sources the filter belongs to.
func derivedTableRange(tokens []sqlToken, fromIdx int) (int, int, bool) {
	open := fromIdx + 1
	if open >= len(tokens) || !isPunctuation(tokens[open], "(") || tokens[open].depth != 0 {
		return 0, 0, false
	}

	var close int
	for i := open + 1; i < len(tokens); i++ {
		if isPunctuation(tokens[i], ")") && tokens[i].depth == 0 {
			close = i
			break
		}
	}
	if close == 0 {
		return 0, 0, false
	}

	// Skip the alias of the derived table, then check that no other source
	// follows the subquery.
	i := close + 1
	if i < len(tokens) && tokens[i].depth == 0 && isAliasToken(tokens[i]) {
		i++
	}
	if i < len(tokens) && tokens[i].depth == 0 {
		next := tokens[i]
		if isPunctuation(next, ",") {
			return 0, 0, false
		}
		if next.kind == sqlTokenWord && joinKeywords[strings.ToUpper(next.text)] {
			return 0, 0, false
		}
	}

	return tokens[open].end, tokens[close].start, true
}

// isAliasToken reports whether the token can be the alias of a table in a FROM
// clause.
func isAliasToken(tok sqlToken) bool {
	switch tok.kind {
	case sqlTokenQuotedIdentifier:
		return true
	case sqlTokenWord:
		word := strings.ToUpper(tok.text)
		return !clauseKeywords[word] && !joinKeywords[word] && word != "WHERE"
	default:
		return false
	}
}

// isPunctuation reports whether the token is the given punctuation character.
func isPunctuation(tok sqlToken, text string) bool {
	return tok.kind == sqlTokenPunctuation && tok.text == text
}

// sqlQueryBranch is one branch of a query that combines several queries with a
// set operation.
type sqlQueryBranch struct {
	query     string
	separator string
}

// splitSetOperationBranches splits a query at its top level set operations. The
// branches are returned in the order they appear in, with the operator that
// separates a branch from the previous one stored in its separator.
func splitSetOperationBranches(query string, tokens []sqlToken) []sqlQueryBranch {
	var operators []int
	for i, tok := range tokens {
		if tok.kind != sqlTokenWord || tok.depth != 0 {
			continue
		}
		switch strings.ToUpper(tok.text) {
		case "UNION", "EXCEPT", "INTERSECT":
			operators = append(operators, i)
		}
	}
	if len(operators) == 0 {
		return nil
	}

	branches := make([]sqlQueryBranch, 0, len(operators)+1)
	start := 0
	for _, opIdx := range operators {
		// The operator can be followed by ALL or DISTINCT, which belongs to the
		// operator and not to the next branch.
		end := tokens[opIdx].end
		separator := strings.ToUpper(tokens[opIdx].text)
		if opIdx+1 < len(tokens) {
			next := tokens[opIdx+1]
			if next.kind == sqlTokenWord && next.depth == 0 {
				switch strings.ToUpper(next.text) {
				case "ALL", "DISTINCT":
					separator += " " + strings.ToUpper(next.text)
					end = next.end
				}
			}
		}

		branches = append(branches, sqlQueryBranch{
			query: strings.TrimSpace(query[start:tokens[opIdx].start]),
		})
		start = end
		branches = append(branches, sqlQueryBranch{separator: separator})
	}
	branches = append(branches, sqlQueryBranch{query: strings.TrimSpace(query[start:])})

	return branches
}

// extendWhereClause adds the time filter to a query that already has a WHERE
// clause, so that the existing condition is kept and the filter is added with
// AND.
func extendWhereClause(query string, tokens []sqlToken, comments []sqlComment, whereIdx int, timeFilter string) string {
	whereEnd := tokens[whereIdx].end
	clauseEnd := whereClauseEnd(query, tokens, comments, whereIdx)

	condition := strings.TrimSpace(query[whereEnd:clauseEnd])
	if condition == "" {
		// A WHERE without a condition is not valid SQL, but the filter is still
		// added so that the query returns the selected time range.
		return splice(query, whereEnd, timeFilter, clauseEnd)
	}

	if hasTopLevelOr(tokens, whereIdx, clauseEnd) {
		// The condition is an OR expression, so it has to be grouped before the
		// filter is added with AND. Without the parentheses the filter would only
		// apply to the last branch of the OR and the query would return rows
		// outside of the selected time range.
		conditionEnd := lastSignificantTokenEnd(tokens, comments, whereEnd, clauseEnd)
		grouped := strings.TrimSpace(query[whereEnd:conditionEnd])
		return splice(query, whereEnd, "("+grouped+") AND "+timeFilter, clauseEnd)
	}

	return splice(query, clauseEnd, "AND "+timeFilter, clauseEnd)
}

// insertWhereClause adds the time filter as a new WHERE clause to a query that
// does not have one. The clause is inserted after the FROM clause and before
// any clause that has to follow the WHERE clause.
func insertWhereClause(query string, tokens []sqlToken, comments []sqlComment, fromIdx int, timeFilter string) string {
	insertAt := len(query)
	for i := fromIdx + 1; i < len(tokens); i++ {
		if isClauseStart(tokens, i) {
			insertAt = tokens[i].start
			break
		}
	}
	insertAt = beforeTrailingLineComment(query, comments, insertAt)

	return splice(query, insertAt, "WHERE "+timeFilter, insertAt)
}

// splice inserts a piece of text into a query at the given offset. The text
// around the insertion point is separated by a single space so that the result
// does not contain double spaces or a missing space. The text that follows the
// insertion starts at suffixStart, which allows the replaced range to differ
// from the insertion point.
func splice(query string, at int, insert string, suffixStart int) string {
	prefix := strings.TrimRight(query[:at], " \t\r\n")
	suffix := strings.TrimLeft(query[suffixStart:], " \t\r\n")

	parts := make([]string, 0, 3)
	if prefix != "" {
		parts = append(parts, prefix)
	}
	if insert != "" {
		parts = append(parts, insert)
	}
	if suffix != "" {
		parts = append(parts, suffix)
	}
	return strings.Join(parts, " ")
}

// whereClauseEnd returns the offset at which the WHERE clause ends, which is
// the start of the next clause or the end of the query.
func whereClauseEnd(query string, tokens []sqlToken, comments []sqlComment, whereIdx int) int {
	for i := whereIdx + 1; i < len(tokens); i++ {
		if isClauseStart(tokens, i) {
			return tokens[i].start
		}
	}
	return beforeTrailingLineComment(query, comments, len(query))
}

// isClauseStart reports whether the token at the given index starts a clause
// that has to follow the WHERE clause.
func isClauseStart(tokens []sqlToken, i int) bool {
	tok := tokens[i]
	if tok.kind != sqlTokenWord || tok.depth != 0 {
		return false
	}
	word := strings.ToUpper(tok.text)
	if !clauseKeywords[word] {
		return false
	}
	if word == "GROUP" || word == "ORDER" {
		// GROUP and ORDER only introduce a clause when they are followed by BY.
		if i+1 >= len(tokens) {
			return false
		}
		next := tokens[i+1]
		return next.kind == sqlTokenWord && next.depth == 0 && strings.ToUpper(next.text) == "BY"
	}
	return true
}

// hasTopLevelOr reports whether the WHERE condition contains an OR that is not
// part of a nested expression.
func hasTopLevelOr(tokens []sqlToken, whereIdx, clauseEnd int) bool {
	depth := tokens[whereIdx].depth
	for i := whereIdx + 1; i < len(tokens); i++ {
		tok := tokens[i]
		if tok.start >= clauseEnd {
			break
		}
		if tok.kind == sqlTokenWord && tok.depth == depth && strings.ToUpper(tok.text) == "OR" {
			return true
		}
	}
	return false
}

// lastSignificantTokenEnd returns the offset at which the last token of the
// range ends, ignoring trailing comments and whitespace. It is used to close a
// parenthesized condition before a trailing comment.
func lastSignificantTokenEnd(tokens []sqlToken, comments []sqlComment, from, to int) int {
	end := from
	for _, tok := range tokens {
		if tok.start < from {
			continue
		}
		if tok.start >= to {
			break
		}
		end = tok.end
	}
	// A comment at the end of the range would swallow the closing parenthesis, so
	// the parenthesis is placed before the comment.
	for _, comment := range comments {
		if comment.start >= from && comment.start < to && comment.end >= to {
			return comment.start
		}
	}
	return end
}

// beforeTrailingLineComment moves the given offset before a line comment that
// runs to the end of the query, so that text inserted at the offset is not
// commented out.
func beforeTrailingLineComment(query string, comments []sqlComment, offset int) int {
	if offset >= len(query) {
		offset = len(query)
	}
	for _, comment := range comments {
		if !comment.line {
			continue
		}
		if comment.start <= offset && comment.end >= len(query) {
			return comment.start
		}
	}
	return offset
}
