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
