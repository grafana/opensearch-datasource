import { grafanaStandardSQLLanguage, grafanaStandardSQLLanguageConf } from '@grafana/plugin-ui';
import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

interface OpenSearchSQLLanguage extends monacoType.languages.IMonarchLanguage {
  id: string;
  keywords: string[];
  functions: string[];
  operators: string[];
}

export const OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID = 'opensearch-sql';

// SQL keywords relevant to OpenSearch SQL. The grammar takes its keywords from
// the standard grammar of the plugin UI package, but the completion offers these.
export const SQL_KEYWORDS = [
  'select',
  'from',
  'where',
  'group',
  'by',
  'order',
  'limit',
  'as',
  'and',
  'or',
  'not',
  'in',
  'like',
  'between',
  'is',
  'null',
  'asc',
  'desc',
  'join',
  'left',
  'right',
  'inner',
  'outer',
  'on',
];

// Common SQL aggregate / scalar functions.
export const SQL_FUNCTIONS = [
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'approx_distinct',
  'stddev',
  'variance',
  'collect_list',
  'collect_set',
  'any_value',
  'corr',
  'covar_pop',
  'covar_samp',
  'percentile',
  'skewness',
  'kurtosis',
  'lower',
  'upper',
  'substr',
  'substring',
  'length',
  'concat',
  'concat_ws',
  'now',
  'date_trunc',
  'cast',
];

export const SQL_OPERATORS = [
  '+',
  '-',
  '*',
  '/',
  '%',
  '=',
  '==',
  '!=',
  '<>',
  '<',
  '<=',
  '>',
  '>=',
];

const standard = grafanaStandardSQLLanguage as unknown as OpenSearchSQLLanguage;

/**
 * The SQL grammar of the query editors.
 *
 * It is the standard grammar of the plugin UI package with the rules this data
 * source needs replaced, rather than a grammar of its own, so the keywords and
 * the tokenizer keep up with the package. What differs:
 *
 * - The token postfix and the id, because completion compares whole token types
 *   against `SQLTokenTypes`, which is built from the id.
 * - A double-quoted value is a string, not an identifier: the engine accepts
 *   `WHERE service = "catalog"`, so highlighting it as an identifier misleads.
 * - Operators are matched on their own, so `SELECT *` highlights the star
 *   instead of reading it as a name.
 * - `#` starts a comment, which the engine accepts alongside `--` and `/*`.
 * - Variables are `$name` or `${name:format}`, and backtick identifiers are
 *   highlighted as identifiers because the data source writes them itself.
 * - The keywords are the ones OpenSearch SQL has. The standard list is T-SQL,
 *   and it holds names the engine reads as fields: `level` and `catalog` are
 *   columns of the fixture index, and highlighting them as keywords would
 *   miscolour a correct query.
 */
export const language: OpenSearchSQLLanguage = {
  ...standard,
  id: OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID,
  tokenPostfix: `.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
  keywords: SQL_KEYWORDS,
  functions: SQL_FUNCTIONS,
  operators: SQL_OPERATORS,
  tokenizer: {
    ...standard.tokenizer,
    root: [
      { include: '@comments' },
      { include: '@whitespace' },
      { include: '@variables' },
      { include: '@strings' },
      { include: '@backtickIdentifiers' },
      { include: '@numbers' },
      [/[()]/, '@brackets'],
      [/[;,.]/, 'delimiter'],
      [/(?:<>|!=|>=|<=|==|[=<>+\-*/%^!])/, 'operator'],
      [
        /[\w@#$]+/,
        {
          cases: {
            '@keywords': 'keyword',
            '@functions': 'predefined',
            '@builtinFunctions': 'predefined',
            '@default': 'identifier',
          },
        },
      ],
    ],
    comments: [
      [/--+.*/, 'comment'],
      [/#.*/, 'comment'],
      [/\/\*/, { token: 'comment.quote', next: '@comment' }],
    ],
    variables: [
      [/\$\{/, { token: 'variable', next: '@variable_braced' }],
      [/\$[a-zA-Z_][\w-]*/, 'variable'],
    ],
    variable_braced: [
      [/[^}]+/, 'variable'],
      [/\}/, { token: 'variable', next: '@pop' }],
    ],
    strings: [
      [/'/, { token: 'string', next: '@string' }],
      [/"/, { token: 'string', next: '@string_double' }],
    ],
    string: [
      [/[^']+/, 'string'],
      [/''/, 'string'],
      [/'/, { token: 'string', next: '@pop' }],
    ],
    string_double: [
      [/[^"\\]+/, 'string'],
      [/\\./, 'string'],
      [/"/, { token: 'string', next: '@pop' }],
    ],
    // The engine accepts a backticked identifier, and the data source writes
    // one when it quotes the time field of a query.
    backtickIdentifiers: [[/`[^`]*`/, 'identifier']],
  },
};

export const conf: monacoType.languages.LanguageConfiguration = grafanaStandardSQLLanguageConf;
