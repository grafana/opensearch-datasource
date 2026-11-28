import { monacoTypes } from '@grafana/ui';

import { OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID } from 'language/sql/language';
import { SQLTokenTypes } from 'language/sql/tokenTypes';

const lang = OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID;
const kw = { type: SQLTokenTypes.Keyword, language: lang };
const fn = { type: SQLTokenTypes.Function, language: lang };
const id = { type: SQLTokenTypes.Identifier, language: lang };
const ws = { type: SQLTokenTypes.Whitespace, language: lang };
const op = { type: SQLTokenTypes.Operator, language: lang };
const paren = { type: SQLTokenTypes.Parenthesis, language: lang };
const delimiter = { type: SQLTokenTypes.Delimiter, language: lang };
const num = { type: SQLTokenTypes.Number, language: lang };
const str = { type: SQLTokenTypes.String, language: lang };

export const emptyQuery = {
  query: '',
  tokens: [],
};

export const whitespaceOnlyQuery = {
  query: '   ',
  tokens: [[{ ...ws, offset: 0 }]] as monacoTypes.Token[][],
};

/** `SELECT ` — cursor on the trailing space after SELECT */
export const selectQuery = {
  query: 'SELECT ',
  tokens: [[{ ...kw, offset: 0 }, { ...ws, offset: 6 }]] as monacoTypes.Token[][],
};

/** `SELECT count ` — function name already typed after SELECT */
export const selectFunctionQuery = {
  query: 'SELECT count ',
  tokens: [[{ ...kw, offset: 0 }, { ...ws, offset: 6 }, { ...fn, offset: 7 }, { ...ws, offset: 12 }]] as monacoTypes.Token[][],
};

/** `SELECT count(` — cursor inside the function parentheses */
export const selectFunctionCallQuery = {
  query: 'SELECT count(',
  tokens: [[{ ...kw, offset: 0 }, { ...ws, offset: 6 }, { ...fn, offset: 7 }, { ...paren, offset: 12 }]] as monacoTypes.Token[][],
};

/** `SELECT * FROM ` — cursor on the trailing space after FROM */
export const fromQuery = {
  query: 'SELECT * FROM ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT * FROM index ` — table name already typed */
export const fromCompleteQuery = {
  query: 'SELECT * FROM index ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
      { ...id, offset: 14 },
      { ...ws, offset: 19 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT * FROM index WHERE ` — cursor on the trailing space after WHERE */
export const whereQuery = {
  query: 'SELECT * FROM index WHERE ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
      { ...id, offset: 14 },
      { ...ws, offset: 19 },
      { ...kw, offset: 20 },
      { ...ws, offset: 25 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT * FROM index WHERE status = ` — cursor after the comparison operator */
export const whereEqualsQuery = {
  query: 'SELECT * FROM index WHERE status = ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
      { ...id, offset: 14 },
      { ...ws, offset: 19 },
      { ...kw, offset: 20 },
      { ...ws, offset: 25 },
      { ...id, offset: 26 },
      { ...ws, offset: 32 },
      { ...op, offset: 33 },
      { ...ws, offset: 34 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT status FROM index GROUP BY ` — cursor after GROUP BY */
export const groupByQuery = {
  query: 'SELECT status FROM index GROUP BY ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...id, offset: 7 },
      { ...ws, offset: 13 },
      { ...kw, offset: 14 },
      { ...ws, offset: 18 },
      { ...id, offset: 19 },
      { ...ws, offset: 24 },
      { ...kw, offset: 25 },
      { ...ws, offset: 30 },
      { ...kw, offset: 31 },
      { ...ws, offset: 33 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT status FROM index ORDER ` — cursor after the ORDER keyword */
export const orderQuery = {
  query: 'SELECT status FROM index ORDER ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...id, offset: 7 },
      { ...ws, offset: 13 },
      { ...kw, offset: 14 },
      { ...ws, offset: 18 },
      { ...id, offset: 19 },
      { ...ws, offset: 24 },
      { ...kw, offset: 25 },
      { ...ws, offset: 30 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT * FROM index JOIN ` — cursor after JOIN (expecting target table) */
export const joinQuery = {
  query: 'SELECT * FROM index JOIN ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
      { ...id, offset: 14 },
      { ...ws, offset: 19 },
      { ...kw, offset: 20 },
      { ...ws, offset: 24 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT * FROM index JOIN other ` — target table already typed */
export const joinCompleteQuery = {
  query: 'SELECT * FROM index JOIN other ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
      { ...id, offset: 14 },
      { ...ws, offset: 19 },
      { ...kw, offset: 20 },
      { ...ws, offset: 24 },
      { ...id, offset: 25 },
      { ...ws, offset: 30 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT * FROM index WHERE \`status_code\` = ` — comparison on a backtick quoted field */
export const whereEqualsQuotedFieldQuery = {
  query: 'SELECT * FROM index WHERE `status_code` = ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
      { ...id, offset: 14 },
      { ...ws, offset: 19 },
      { ...kw, offset: 20 },
      { ...ws, offset: 25 },
      { ...id, offset: 26 },
      { ...ws, offset: 39 },
      { ...op, offset: 40 },
      { ...ws, offset: 41 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT * FROM index WHERE status > ` — an operator that has no value suggestions */
export const whereGreaterThanQuery = {
  query: 'SELECT * FROM index WHERE status > ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
      { ...id, offset: 14 },
      { ...ws, offset: 19 },
      { ...kw, offset: 20 },
      { ...ws, offset: 25 },
      { ...id, offset: 26 },
      { ...ws, offset: 32 },
      { ...op, offset: 33 },
      { ...ws, offset: 34 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT * FROM index WHERE host.name = ` — comparison on a field with a dot in its name */
export const whereEqualsDottedFieldQuery = {
  query: 'SELECT * FROM index WHERE host.name = ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
      { ...id, offset: 14 },
      { ...ws, offset: 19 },
      { ...kw, offset: 20 },
      { ...ws, offset: 25 },
      { ...id, offset: 26 },
      { ...delimiter, offset: 30 },
      { ...id, offset: 31 },
      { ...ws, offset: 35 },
      { ...op, offset: 36 },
      { ...ws, offset: 37 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT * FROM index WHERE name = ` — a field whose name is the end of a longer field */
export const whereEqualsShortFieldQuery = {
  query: 'SELECT * FROM index WHERE name = ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
      { ...id, offset: 14 },
      { ...ws, offset: 19 },
      { ...kw, offset: 20 },
      { ...ws, offset: 25 },
      { ...id, offset: 26 },
      { ...ws, offset: 30 },
      { ...op, offset: 31 },
      { ...ws, offset: 32 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT * FROM index WHERE level = ` — a keyword field compared with a numeric term */
export const whereEqualsKeywordFieldQuery = {
  query: 'SELECT * FROM index WHERE level = ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
      { ...id, offset: 14 },
      { ...ws, offset: 19 },
      { ...kw, offset: 20 },
      { ...ws, offset: 25 },
      { ...id, offset: 26 },
      { ...ws, offset: 31 },
      { ...op, offset: 32 },
      { ...ws, offset: 33 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT * FROM index WHERE COUNT(status_code) = ` — a function call left of the operator */
export const whereEqualsFunctionCallQuery = {
  query: 'SELECT * FROM index WHERE COUNT(status_code) = ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
      { ...id, offset: 14 },
      { ...ws, offset: 19 },
      { ...kw, offset: 20 },
      { ...ws, offset: 25 },
      { ...fn, offset: 26 },
      { ...paren, offset: 31 },
      { ...id, offset: 32 },
      { ...paren, offset: 43 },
      { ...ws, offset: 44 },
      { ...op, offset: 45 },
      { ...ws, offset: 46 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT * FROM index WHERE 1 = ` — a number left of the operator */
export const whereEqualsNumberQuery = {
  query: 'SELECT * FROM index WHERE 1 = ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
      { ...id, offset: 14 },
      { ...ws, offset: 19 },
      { ...kw, offset: 20 },
      { ...ws, offset: 25 },
      { ...num, offset: 26 },
      { ...ws, offset: 27 },
      { ...op, offset: 28 },
      { ...ws, offset: 29 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT * FROM index WHERE = ` — nothing left of the operator */
export const whereEqualsNothingQuery = {
  query: 'SELECT * FROM index WHERE = ',
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
      { ...id, offset: 14 },
      { ...ws, offset: 19 },
      { ...kw, offset: 20 },
      { ...ws, offset: 25 },
      { ...op, offset: 26 },
      { ...ws, offset: 27 },
    ],
  ] as monacoTypes.Token[][],
};

/** `SELECT * FROM index WHERE 'x' = ` — a string literal left of the operator */
export const whereEqualsStringQuery = {
  query: "SELECT * FROM index WHERE 'x' = ",
  tokens: [
    [
      { ...kw, offset: 0 },
      { ...ws, offset: 6 },
      { ...op, offset: 7 },
      { ...ws, offset: 8 },
      { ...kw, offset: 9 },
      { ...ws, offset: 13 },
      { ...id, offset: 14 },
      { ...ws, offset: 19 },
      { ...kw, offset: 20 },
      { ...ws, offset: 25 },
      { ...str, offset: 26 },
      { ...ws, offset: 29 },
      { ...op, offset: 30 },
      { ...ws, offset: 31 },
    ],
  ] as monacoTypes.Token[][],
};
