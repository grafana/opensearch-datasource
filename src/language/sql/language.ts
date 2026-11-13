import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

interface OpenSearchSQLLanguage extends monacoType.languages.IMonarchLanguage {
  keywords: string[];
  functions: string[];
  operators: string[];
}

export const OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID = 'opensearch-sql';

// SQL keywords relevant to OpenSearch SQL.
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

export const language: OpenSearchSQLLanguage = {
  defaultToken: '',
  id: OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID,
  ignoreCase: true,
  keywords: SQL_KEYWORDS,
  functions: SQL_FUNCTIONS,
  operators: SQL_OPERATORS,
  brackets: [{ open: '(', close: ')', token: 'delimiter.parenthesis' }],
  tokenizer: {
    root: [
      { include: '@comments' },
      { include: '@whitespace' },
      { include: '@variables' },
      { include: '@strings' },
      { include: '@numbers' },

      [/[(),]/, 'delimiter.parenthesis'],
      [/[,.]/, 'delimiter'],
      [/[+\-*/^%=!<>]/, 'operator'],

      [
        /[\w@#$]+/,
        {
          cases: {
            '@keywords': 'keyword',
            '@functions': 'predefined',
            '@operators': 'operator',
            '@default': 'identifier',
          },
        },
      ],
    ],
    variables: [
      [/\${/, { token: 'variable', next: '@variable_bracket' }],
      [/\$[a-zA-Z0-9-_]+/, 'variable'],
    ],
    variable_bracket: [
      [/[a-zA-Z0-9-_:]+/, 'variable'],
      [/}/, { token: 'variable', next: '@pop' }],
    ],
    whitespace: [[/\s+/, 'white']],
    comments: [
      [/^#.*/, 'comment'],
      [/--.*$/, 'comment'],
      [/\s+#.*/, 'comment'],
    ],
    numbers: [
      [/0[xX][0-9a-fA-F]*/, 'number'],
      [/[$][+-]*\d*(\.\d*)?/, 'number'],
      [/((\d+(\.\d*)?)|(\.\d+))([eE][\-+]?\d+)?/, 'number'],
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
      [/[^\\"]+/, 'string'],
      [/"/, 'string', '@pop'],
    ],
  },
};

export const conf: monacoType.languages.LanguageConfiguration = {
  brackets: [['(', ')']],
  autoClosingPairs: [
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
};
