import { monacoTypes } from '@grafana/ui';
import { OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID } from 'language/ppl/language';
import { PPLTokenTypes } from 'language/ppl/tokenTypes';

export const emptyQuery = {
  query: '',
  tokens: [],
};

export const whitespaceOnlyQuery = {
  query: '   ',
  tokens: [
    [{ offset: 0, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }],
  ] as monacoTypes.Token[][],
};

export const searchQueryWithIndexClause = {
  query: `SEARCH index = inventory (status = 'in-stock' AND NOT category = /clearance/ ) OR like(supplier, 'SupplierA')  `,
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "SEARCH"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "index"
      { offset: 12, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 13, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 14, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 15, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "inventory"
      { offset: 24, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 25, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 26, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "status"
    ],
  ] as monacoTypes.Token[][],
};
export const searchQuery = {
  query: `SEARCH source = inventory (status = 'in-stock' AND NOT category = /clearance/ ) OR like(supplier, 'SupplierA')  `,
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "SEARCH"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "source"
      { offset: 13, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 14, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 15, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 16, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "inventory"
      { offset: 25, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 26, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 27, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "status"
      { offset: 33, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 34, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 35, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 36, type: PPLTokenTypes.String, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "'in-stock'"
      { offset: 46, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 47, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "AND"
      { offset: 50, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 51, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "NOT"
      { offset: 54, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 55, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "category"
      { offset: 63, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 64, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 65, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 66, type: PPLTokenTypes.Regexp, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "/clearance/"
      { offset: 77, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 78, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 79, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 80, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "OR"
      { offset: 82, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 83, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "like"
      { offset: 87, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 88, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "supplier"
      { offset: 96, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 97, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 98, type: PPLTokenTypes.String, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "'SupplierA'"
      { offset: 109, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ")"
      { offset: 110, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
    ],
  ] as monacoTypes.Token[][],
};

export const whereQuery = {
  query: 'where like(`@message`, "%Exception%") AND not like(server, "test") in ()',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "WHERE"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "like"
      { offset: 10, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 11, type: PPLTokenTypes.Backtick, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "`@message`"
      { offset: 21, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 22, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 23, type: PPLTokenTypes.String, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "%Exception"
      { offset: 36, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ")"
      { offset: 37, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 38, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "and"
      { offset: 41, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 42, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "not"
      { offset: 45, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 46, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "like"
      { offset: 50, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 51, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "server"
      { offset: 57, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 58, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 59, type: PPLTokenTypes.String, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "'test'"
      { offset: 55, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ")"
      { offset: 66, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 67, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "in"
      { offset: 69, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 70, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
    ],
  ] as monacoTypes.Token[][],
};
export const fieldsQuery = {
  query: 'FIELDS + `@ingestionTime`, timestamp, table',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "fields"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "+"
      { offset: 8, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 9, type: PPLTokenTypes.Backtick, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "@ingestionTime"
      { offset: 25, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 26, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " ",
      { offset: 27, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp",
      { offset: 36, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 37, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 38, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "table"
    ],
  ] as monacoTypes.Token[][],
};

export const statsQuery = {
  query: 'stats avg(timestamp) as exceptionCount by span(`@timestamp`, 1h)',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "stats"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "avg"
      { offset: 9, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 10, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp",
      { offset: 19, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ")",
      { offset: 20, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 21, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "as"
      { offset: 23, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 24, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "exceptionCount"
      { offset: 38, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 39, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "by"
      { offset: 41, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 42, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "span"
      { offset: 46, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 47, type: PPLTokenTypes.Backtick, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "@timestmap"
      { offset: 59, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 60, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 61, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "1h"
    ],
  ] as monacoTypes.Token[][],
};

export const eventStatsQuery = {
  query: 'EVENTSTATS avg(timestamp) as exceptionCount by span(`@timestamp`, 1h)',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "eventstats"
      { offset: 10, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 11, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "avg"
      { offset: 14, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 15, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp",
      { offset: 24, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ")",
      { offset: 25, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 26, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "as"
      { offset: 28, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 29, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "exceptionCount"
      { offset: 43, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 44, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "by"
      { offset: 46, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 47, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "span"
      { offset: 51, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 52, type: PPLTokenTypes.Backtick, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "@timestmap"
      { offset: 64, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 65, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 66, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "1h"
    ],
  ] as monacoTypes.Token[][],
};

export const sortQuery = {
  query: 'sort - DisconnectReason, + timestamp, server',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "sort"
      { offset: 4, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 5, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "-"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "DisconnectReason"
      { offset: 23, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 24, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 25, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "+"
      { offset: 26, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 27, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 36, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 37, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 38, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "server"
    ],
  ] as monacoTypes.Token[][],
};
export const sortQueryWithFunctions = {
  query: 'sort - AUTO(DisconnectReason)',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "sort"
      { offset: 4, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 5, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "-"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "AUTO"
      { offset: 11, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 12, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "DisconnectReason"
    ],
  ] as monacoTypes.Token[][],
};

export const dedupQueryWithOptionalArgs = {
  query: 'DEDUP 5 timestamp, ingestionTime, `@query` keepempty = true consecutive = false',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "dedup"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "5"
      { offset: 7, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 8, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 17, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 18, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 19, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "ingestionTime"
      { offset: 32, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 33, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 34, type: PPLTokenTypes.Backtick, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "`@query`"
      { offset: 42, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 43, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "keepempty"
      { offset: 52, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 53, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 54, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 55, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "true"
      { offset: 59, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 60, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "consecutive"
      { offset: 71, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 72, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 73, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 74, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "false"
    ],
  ] as monacoTypes.Token[][],
};

export const dedupQueryWithoutOptionalArgs = {
  query: 'DEDUP timestamp, ingestionTime, `@query`',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "dedup"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 15, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 16, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 17, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "ingestionTime"
      { offset: 30, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 31, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 32, type: PPLTokenTypes.Backtick, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "`@query`"
    ],
  ] as monacoTypes.Token[][],
};

export const topQuery = {
  query: 'TOP 100 ingestionTime, timestamp by server, region',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "top"
      { offset: 3, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 4, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "100"
      { offset: 7, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 8, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "ingestionTime"
      { offset: 21, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 22, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 23, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 32, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 33, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "by"
      { offset: 35, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 36, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "server"
      { offset: 42, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 43, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 44, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "region"
    ],
  ] as monacoTypes.Token[][],
};

export const headQuery = {
  query: 'HEAD 10 from 1500',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "head"
      { offset: 4, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 5, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "10"
      { offset: 7, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 8, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "from"
      { offset: 12, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 13, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "1500"
    ],
  ] as monacoTypes.Token[][],
};
export const rareQuery = {
  query: 'RARE server, ingestionTime by region, user',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "rare"
      { offset: 4, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 5, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "server"
      { offset: 11, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 12, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 13, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "ingestionTime"
      { offset: 26, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 27, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "by"
      { offset: 29, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 30, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "region"
      { offset: 36, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 37, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 38, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "user"
    ],
  ] as monacoTypes.Token[][],
};

export const evalQuery = {
  query:
    'EVAL total_revenue = price * quantity, discount_price = price >= 0.9, revenue_category = IF(price BETWEEN 100 AND 200, "high", "low")',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "eval"
      { offset: 4, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 5, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "total_revenue"
      { offset: 18, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 19, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 20, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 21, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "price"
      { offset: 26, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 27, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "*"
      { offset: 28, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 29, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "quantity"
      { offset: 37, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 38, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 39, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "discount_price"
      { offset: 53, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 54, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 55, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 56, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "price"
      { offset: 61, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 62, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ">="
      { offset: 64, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 65, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "0.9"
      { offset: 68, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 69, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 70, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "revenue_category"
      { offset: 86, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 87, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 88, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 89, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "IF"
      { offset: 91, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 92, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "price"
      { offset: 97, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 98, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "between"
      { offset: 105, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 106, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "100"
    ],
  ] as monacoTypes.Token[][],
};

export const parseQuery = {
  query: 'parse email ".+@(?<host>.+)"',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "parse"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "email"
      { offset: 11, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 12, type: PPLTokenTypes.String, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // '".+@(?<host>.+)"
    ],
  ] as monacoTypes.Token[][],
};
export const queryWithArithmeticOps = {
  query: 'where price * discount >= 200',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "where"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "price"
      { offset: 11, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 12, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "*"
      { offset: 13, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 14, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "discount"
      { offset: 22, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 23, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ">="
      { offset: 25, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 26, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "200"
    ],
  ] as monacoTypes.Token[][],
};
export const queryWithLogicalExpression = {
  query: 'where orders = "shipped" OR NOT /returned/ AND price > 20',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "where"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "orders"
      { offset: 12, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 13, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 14, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 15, type: PPLTokenTypes.String, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "'shipped'"
      { offset: 24, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 25, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "OR"
      { offset: 27, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 28, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "NOT"
      { offset: 31, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 32, type: PPLTokenTypes.Regexp, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "/returned/"
      { offset: 42, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 43, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "AND"
      { offset: 46, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 47, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "price"
      { offset: 52, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 53, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ">"
      { offset: 54, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 55, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "20"
    ],
  ] as monacoTypes.Token[][],
};
export const queryWithFieldList = {
  query: 'fields ingestionTime, timestamp, `@server`, bytesReceived',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "fields"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "ingestionTime"
      { offset: 20, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 21, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 22, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 31, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 32, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 33, type: PPLTokenTypes.Backtick, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "`@server`"
      { offset: 42, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 43, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 44, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "bytesReceived"
    ],
  ] as monacoTypes.Token[][],
};

export const queryWithFunctionCalls = {
  query: 'where like(dstAddr, ) where logType = "Tracing"| where cos(`duration`), right(`duration`)',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "where"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "like"
      { offset: 10, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 11, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "dstAddr"
      { offset: 18, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 19, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 20, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ")"
      { offset: 21, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 22, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // where
      { offset: 27, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 28, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // logType
      { offset: 35, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 36, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // =
      { offset: 37, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 38, type: PPLTokenTypes.String, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "Tracing"
      { offset: 47, type: PPLTokenTypes.Pipe, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 48, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ""
      { offset: 49, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "where"
      { offset: 54, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 55, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "cos"
      { offset: 58, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 59, type: PPLTokenTypes.Backtick, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "`duration`"
      { offset: 69, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ")"
      { offset: 70, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 71, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 72, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "right"
      { offset: 77, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
    ],
  ] as monacoTypes.Token[][],
};

export const joinQuery = {
  query:
    'left outer join left = table1 right = table2 left_hint.id = leftIdent on isnull(leftIdent) = false right = table2',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "left"
      { offset: 4, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 5, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "outer"
      { offset: 10, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 11, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "join"
      { offset: 15, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 16, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "left"
      { offset: 20, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 21, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 22, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 23, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "table1"
      { offset: 29, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 30, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "right"
      { offset: 35, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 36, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 37, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 38, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "table2"
      { offset: 44, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 45, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "left_hint"
      { offset: 54, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "."
      { offset: 55, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "id"
      { offset: 57, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 58, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 59, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 60, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "leftIdent"
      { offset: 69, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 70, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "on"
      { offset: 72, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 73, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "isnull"
      { offset: 79, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 80, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "leftIdent"
      { offset: 89, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ")"
      { offset: 90, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 91, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 92, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 93, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "false"
      { offset: 98, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 99, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "right"
      { offset: 104, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 105, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 106, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 107, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "table2"
    ],
  ] as monacoTypes.Token[][],
};

export const renameQuery = {
  query: 'rename @timestamp as startTime, bytes as value',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "rename"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 16, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 17, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "as"
      { offset: 19, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 20, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "startTime"
      { offset: 29, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 30, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 31, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "bytes"
      { offset: 36, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 37, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "as"
      { offset: 39, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 40, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "value"
    ],
  ] as monacoTypes.Token[][],
};

export const grokQuery = {
  query: 'grok email ".+@%{HOSTNAME:host}"',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "grok"
      { offset: 4, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 5, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "email"
      { offset: 10, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 11, type: 'string.opensearch-ppl', language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // '".+@%{HOSTNAME:host}"'
    ],
  ] as monacoTypes.Token[][],
};

export const patternsQuery = {
  query:
    'patterns host = isnull(field1)=false by domain mode = aggregation method = simple_pattern BUFFER_LIMIT=10 VARIABLE_COUNT_THRESHOLD=3',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "patterns"
      { offset: 8, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 9, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "host"
      { offset: 13, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 14, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 15, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 16, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "isnull"
      { offset: 22, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 23, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "field1"
      { offset: 29, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ")"
      { offset: 30, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 31, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "false"
      { offset: 36, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 37, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "by"
      { offset: 39, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 41, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "domain"
      { offset: 46, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 47, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "mode"
      { offset: 51, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 52, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 53, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 54, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "aggregation"
      { offset: 65, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 66, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "method"
      { offset: 72, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 73, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 74, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 75, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "simple_pattern"
      { offset: 89, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 90, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "BUFFER_LIMIT"
      { offset: 102, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 103, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 104, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 105, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "10"
      { offset: 108, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "VARIABLE_COUNT_THRESHOLD"
      { offset: 132, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 133, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 134, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 135, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "3"
    ],
  ] as monacoTypes.Token[][],
};

export const lookupQuery = {
  query: 'lookup usersTable amount as total APPEND userId as id REPLACE amount as value',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "lookup"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "usersTable"
      { offset: 17, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 18, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "amount"
      { offset: 24, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 25, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "as"
      { offset: 27, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 28, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "total"
      { offset: 33, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 34, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "APPEND"
      { offset: 40, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 41, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "userId"
      { offset: 47, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 48, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "as"
      { offset: 50, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 51, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "id"
      { offset: 53, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 54, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "REPLACE"
      { offset: 61, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 62, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "amount"
      { offset: 68, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 69, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "as"
      { offset: 71, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 72, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "value"
    ],
  ] as monacoTypes.Token[][],
};
export const kmeansQuery = {
  query: 'kmeans centroids=3 iterations=100',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "kmeans"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "centroids"
      { offset: 16, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 17, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "3"
      { offset: 18, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 19, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "iterations"
      { offset: 29, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 30, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "100"
    ],
  ] as monacoTypes.Token[][],
};
export const adQuery = {
  query: 'ad shingle_size=8 sample_size=512 anomaly_rate=0.05',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "ad"
      { offset: 2, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 3, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "shingle_size"
      { offset: 15, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 16, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "8"
      { offset: 17, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 18, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "sample_size"
      { offset: 29, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 30, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "512"
      { offset: 33, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 34, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "anomaly_rate"
      { offset: 46, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 47, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "0.05"
    ],
  ] as monacoTypes.Token[][],
};
export const mlQuery = {
  query: 'ml `algorithm`=tree_split',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "ml"
      { offset: 2, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 3, type: PPLTokenTypes.Backtick, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "`algorithm`"
      { offset: 14, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 15, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "tree_split"
    ],
  ] as monacoTypes.Token[][],
};
export const fillNullWithQuery = {
  query: 'fillnull WITH field1 * field2 in timestamp, userId',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "fillnull"
      { offset: 8, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 9, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "WITH"
      { offset: 13, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 14, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "field1"
      { offset: 20, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 21, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "*"
      { offset: 22, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 23, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "field2"
      { offset: 29, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 30, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "in"
      { offset: 32, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 33, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 42, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 43, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 44, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "userId"
    ],
  ] as monacoTypes.Token[][],
};
export const fillNullUsingQuery = {
  query: 'fillnull using userId = "123", field1 = 0 field 2= "N/A" field3 = false',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "fillnull"
      { offset: 8, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 9, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "using"
      { offset: 14, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 15, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "userId"
      { offset: 21, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 22, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 23, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 24, type: PPLTokenTypes.String, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // '"123"'
      { offset: 29, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 30, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 31, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "field1"
      { offset: 37, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 38, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 39, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 40, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "0"
      { offset: 41, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 42, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "field"
      { offset: 47, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 48, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "2"
      { offset: 49, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 50, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 51, type: PPLTokenTypes.String, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // '"N/A"'
      { offset: 56, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 57, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "field3"
      { offset: 63, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 64, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 65, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 66, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "false"
    ],
  ] as monacoTypes.Token[][],
};
export const trendlineQuery = {
  query: 'trendline sort -byte_sent SMA(6, num_bytes) as bytes',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "trendline"
      { offset: 9, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 10, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "sort"
      { offset: 14, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 15, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "-"
      { offset: 16, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "byte_sent"
      { offset: 25, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 26, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "SMA"
      { offset: 29, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 30, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "6"
      { offset: 31, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 32, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 33, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "num_bytes"
      { offset: 42, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ")"
      { offset: 43, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 44, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "as"
      { offset: 46, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 47, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "bytes"
    ],
  ] as monacoTypes.Token[][],
};
export const appendColQuery = {
  query: 'appendcol override=true [fillnull field1=0  | trendline sort -timestamp]',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "appendcol"
      { offset: 9, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 10, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "override"
      { offset: 18, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 19, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "true"
      { offset: 23, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 24, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "["
      { offset: 25, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "fillnull"
      { offset: 33, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 34, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "field1"
      { offset: 40, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 41, type: PPLTokenTypes.Number, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "0"
      { offset: 42, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 44, type: PPLTokenTypes.Pipe, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 45, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 46, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "trendline"
      { offset: 55, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 56, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "sort"
      { offset: 60, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 61, type: PPLTokenTypes.Operator, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "-"
      { offset: 62, type: PPLTokenTypes.Function, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 71, type: PPLTokenTypes.Parenthesis, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "]"
    ],
  ] as monacoTypes.Token[][],
};
export const expandQuery = {
  query: 'expand field1 as renamedField1',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "expand"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "field1"
      { offset: 13, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 14, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "as"
      { offset: 16, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 17, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "renamedField1"
    ],
  ] as monacoTypes.Token[][],
};
export const flattenQuery = {
  query: 'flatten field1 as field2, field3',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "flatten"
      { offset: 7, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 8, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "field1"
      { offset: 14, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 15, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "as"
      { offset: 17, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 18, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "field2"
      { offset: 24, type: PPLTokenTypes.Delimiter, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 25, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 26, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "field3"
    ],
  ] as monacoTypes.Token[][],
};
export const reverseQuery = {
  query: 'reverse  ',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // "reverse"
      { offset: 7, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 8, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID }, // ""
    ],
  ] as monacoTypes.Token[][],
};
