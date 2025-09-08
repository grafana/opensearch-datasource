import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

// OpenSearch PPL syntax: https://github.com/opensearch-project/sql/blob/main/ppl/src/main/antlr/OpenSearchPPLLexer.g4
interface OpenSearchPPLLanguage extends monacoType.languages.IMonarchLanguage {
  commands: string[];
  operators: string[];
  builtinFunctions: string[];
}

export const OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID = 'opensearch-ppl';

// COMMANDS
export const SEARCH = 'search';
export const DESCRIBE = 'describe';
export const SHOW = 'show';
export const WHERE = 'where';
export const FIELDS = 'fields';
export const JOIN = 'join';
export const RENAME = 'rename';
export const STATS = 'stats';

export const EVENTSTATS = 'eventstats';
export const DEDUP = 'dedup';
export const SORT = 'sort';
export const EVAL = 'eval';
export const HEAD = 'head';
export const TOP = 'top';
export const RARE = 'rare';
export const PARSE = 'parse';

export const GROK = 'grok';
export const PATTERNS = 'patterns';
export const KMEANS = 'kmeans';
export const LOOKUP = 'lookup';
export const AD = 'ad';
export const ML = 'ml';
export const FILLNULL = 'fillnull';
export const EXPAND = 'expand';
export const FLATTEN = 'flatten';
export const TRENDLINE = 'trendline';
export const EXPLAIN = 'explain';
export const APPENDCOL = 'appendcol';
export const REVERSE = 'reverse';

export const PPL_COMMANDS = [
  SEARCH,
  DESCRIBE,
  SHOW,
  WHERE,
  FIELDS,
  JOIN,
  RENAME,
  STATS,
  EVENTSTATS,
  DEDUP,
  SORT,
  EVAL,
  HEAD,
  TOP,
  RARE,
  PARSE,
  GROK,
  PATTERNS,
  KMEANS,
  LOOKUP,
  AD,
  ML,
  FILLNULL,
  TRENDLINE,
  EXPAND,
  FLATTEN,
  APPENDCOL,
  REVERSE,
];

// KEYWORDS

// command keywords
export const REGEX = 'regex';
export const PUNCT = 'punct';
export const NEW_FIELD = 'new_field';

export const PATTERN = 'pattern';
export const METHOD = 'method';
export const MODE = 'mode';
const BRAIN = 'brain';
const SIMPLE_PATTERN = 'simple_pattern';
export const FREQUENCY_THRESHOLD_PERCENTAGE = 'frequency_threshold_percentage';
export const VARIABLE_COUNT_THRESHOLD = 'variable_count_threshold';
const BUFFER_LIMIT = 'buffer_limit';
const MAX_SAMPLE_COUNT = 'max_sample_count';
const LABEL = 'label';
const AGGREGATION = 'aggregation';
export const PATTERNS_PARAMETERS = [
  METHOD,
  MODE,
  MAX_SAMPLE_COUNT,
  BUFFER_LIMIT,
  NEW_FIELD,
  VARIABLE_COUNT_THRESHOLD,
  FREQUENCY_THRESHOLD_PERCENTAGE,
  PATTERN,
];
export const PATTERN_METHODS = [SIMPLE_PATTERN, BRAIN];
export const PATTERN_MODES = [LABEL, AGGREGATION];
export const PATTERNS_PARAMETER_LITERAL = [
  PATTERN,
  NEW_FIELD,
  BUFFER_LIMIT,
  MAX_SAMPLE_COUNT,
  VARIABLE_COUNT_THRESHOLD,
  FREQUENCY_THRESHOLD_PERCENTAGE,
];
// join keywords
export const ON = 'on';
const LEFT_OUTER = 'left outer';
const RIGHT_OUTER = 'right outer';
const FULL_OUTER = 'full outer';
export const LEFT = 'left';
export const RIGHT = 'right';
const SEMI = 'semi';
const ANTI = 'anti';
const CROSS = 'cross';
const OUTER = 'outer';
export const LEFT_HINT = 'left_hint';
export const RIGHT_HINT = 'right_hint';
export const JOIN_TYPE = [LEFT_OUTER, RIGHT_OUTER, FULL_OUTER, LEFT, SEMI, ANTI, CROSS];
export const JOIN_METHODS = [OUTER, SEMI, ANTI];

// command assist keywords
export const AS = 'as';
export const BY = 'by';
export const BETWEEN = 'between';
export const FROM = 'from';

export const SOURCE = 'source';
export const INDEX = 'index';
export const D = 'd';
export const DESC = 'desc';
export const DATASOURCES = 'datasources';

export const USING = 'using';
export const WITH = 'with';

export const FILLNULL_PARAMETERS = [WITH, USING];

export const SIMPLE = 'simple';
export const STANDARD = 'standard';
export const COST = 'cost';
export const EXTENDED = 'extended';
export const OVERRIDE = 'override';

// sort field keywords
export const AUTO = 'auto';
export const STR = 'str';
export const NUM = 'num';

// trendline keywords
export const SMA = 'sma';
export const WMA = 'wma';
export const TRENDLINE_TYPE = [SMA, WMA];

// kmeans parameters
const CENTROIDS = 'centroids';
const ITERATIONS = 'iterations';
const DISTANCE_TYPE = 'distance_type';

export const KMEANS_PARAMETERS = [CENTROIDS, ITERATIONS, DISTANCE_TYPE];

const NUMBER_OF_TREES = 'number_of_trees';
const SHINGLE_SIZE = 'shingle_size';
const SAMPLE_SIZE = 'sample_size';
const OUTPUT_AFTER = 'output_after';
const TIME_DECAY = 'time_decay';
const ANOMALY_RATE = 'anomaly_rate';
const CATEGORY_FIELD = 'category_field';
const TIME_FIELD = 'time_field';
const TIME_ZONE = 'time_zone';
const TRAINING_DATA_SIZE = 'training_data_size';
const ANOMALY_SCORE_THRESHOLD = 'anomaly_score_threshold';

export const AD_PARAMETERS = [
  NUMBER_OF_TREES,
  SHINGLE_SIZE,
  SAMPLE_SIZE,
  OUTPUT_AFTER,
  TIME_DECAY,
  ANOMALY_RATE,
  CATEGORY_FIELD,
  TIME_FIELD,
  TIME_ZONE,
  TRAINING_DATA_SIZE,
  ANOMALY_SCORE_THRESHOLD,
];

// argument keywords
export const KEEP_EMPTY = 'keepempty';
export const CONSECUTIVE = 'consecutive';
export const DEDUP_SPLITVALUES = 'dedup_splitvalues';
export const PARTITIONS = 'partitions';
export const ALLNUM = 'allnum';
export const DELIM = 'delim';

export const APPEND = 'append';
export const REPLACE = 'replace';
export const COUNTFIELD = 'countfield';
export const SHOWCOUNT = 'showcount';

// comparison function keywords
export const CASE = 'case';
export const IN = 'in';
export const ELSE = 'else';
export const EXISTS = 'exists';

// logical keywords
// NOT is covered in operators;
export const OR = 'or';
export const AND = 'and';
export const XOR = 'xor';
export const TRUE = 'true';
export const FALSE = 'false';
export const REGEXP = 'regexp';

// datetime, interval, unit keywords
export const CONVERT_TZ = 'convert_tz';
export const DATETIME = 'datetime';
export const DAY = 'day';
export const DAY_HOUR = 'day_hour';
export const DAY_MICROSECOND = 'day_microsecond';
export const DAY_MINUTE = 'day_minute';
export const DAY_OF_YEAR = 'day_of_year';
export const DAY_SECOND = 'day_second';
export const HOUR = 'hour';
export const HOUR_MICROSECOND = 'hour_microsecond';
export const HOUR_MINUTE = 'hour_minute';
export const HOUR_OF_DAY = 'hour_of_day';
export const HOUR_SECOND = 'hour_second';
export const INTERVAL = 'interval';
export const MICROSECOND = 'microsecond';
export const MILLISECOND = 'millisecond';
export const MINUTE = 'minute';
export const MINUTE_MICROSECOND = 'minute_microsecond';
export const MINUTE_OF_DAY = 'minute_of_day';
export const MINUTE_OF_HOUR = 'minute_of_hour';
export const MINUTE_SECOND = 'minute_second';
export const MONTH = 'month';
export const MONTH_OF_YEAR = 'month_of_year';
export const QUARTER = 'quarter';
export const SECOND = 'second';
export const SECOND_MICROSECOND = 'second_microsecond';
export const SECOND_OF_MINUTE = 'second_of_minute';
export const WEEK = 'week';
export const WEEK_OF_YEAR = 'week_of_year';
export const YEAR = 'year';
export const YEAR_MONTH = 'year_month';

export const STATS_PARAMETERS = [PARTITIONS, ALLNUM, DELIM, DEDUP_SPLITVALUES];
export const DEDUP_PARAMETERS = [KEEP_EMPTY, CONSECUTIVE];
export const PARAMETERS_WITH_BOOLEAN_VALUES = [ALLNUM, DEDUP_SPLITVALUES, KEEP_EMPTY, CONSECUTIVE];
export const RELEVANCE_PARAMETERS = [
  'allow_leading_wildcard',
  'analyze_wildcard',
  'analyzer',
  'auto_generate_synonyms_phrase_query',
  'boost',
  'cutoff_frequency',
  'default_field',
  'default_operator',
  'enable_position_increments',
  'escape',
  'flags',
  'fuzzy_max_expansions',
  'fuzzy_prefix_length',
  'fuzzy_transpositions',
  'fuzzy_rewrite',
  'fuzziness',
  'lenient',
  'low_freq_operator',
  'max_determinized_states',
  'max_expansions',
  'minimum_should_match',
  'operator',
  'phrase_slop',
  'prefix_length',
  'quote_analyzer',
  'quote_field_suffix',
  'rewrite',
  'slop',
  'tie_breaker',
  'type',
  'zero_terms_query',
];
export const DATETIME_KEYWORDS = [
  CONVERT_TZ,
  DATETIME,
  DAY,
  DAY_HOUR,
  DAY_MICROSECOND,
  DAY_MINUTE,
  DAY_OF_YEAR,
  DAY_SECOND,
  HOUR,
  HOUR_MICROSECOND,
  HOUR_MINUTE,
  HOUR_OF_DAY,
  HOUR_SECOND,
  INTERVAL,
  MICROSECOND,
  MILLISECOND,
  MINUTE,
  MINUTE_MICROSECOND,
  MINUTE_OF_DAY,
  MINUTE_OF_HOUR,
  MINUTE_SECOND,
  MONTH,
  MONTH_OF_YEAR,
  QUARTER,
  SECOND,
  SECOND_MICROSECOND,
  SECOND_OF_MINUTE,
  WEEK,
  WEEK_OF_YEAR,
  YEAR,
  YEAR_MONTH,
];
export const LOGICAL_KEYWORDS = [OR, AND, XOR, TRUE, FALSE, REGEXP];
export const COMPARISON_KEYWORDS = [CASE, IN];
export const ARGUMENT_KEYWORDS = [
  KEEP_EMPTY,
  CONSECUTIVE,
  DEDUP_SPLITVALUES,
  PARTITIONS,
  ALLNUM,
  DELIM,
  NUMBER_OF_TREES,
  SHINGLE_SIZE,
  SAMPLE_SIZE,
  OUTPUT_AFTER,
  TIME_DECAY,
  ANOMALY_RATE,
  CATEGORY_FIELD,
  TIME_FIELD,
  TIME_ZONE,
  TRAINING_DATA_SIZE,
  ANOMALY_SCORE_THRESHOLD,
  ...KMEANS_PARAMETERS,
];
export const COMMAND_ASSIST_KEYWORDS = [BY, BETWEEN, FROM, SOURCE, INDEX, DESC, DATASOURCES];
export const BOOLEAN_LITERALS = ['true', 'false'];

export const ALL_KEYWORDS = [
  AS,
  BY,
  IN,
  BETWEEN,
  FROM,
  ...STATS_PARAMETERS,
  ...DEDUP_PARAMETERS,
  ...BOOLEAN_LITERALS,
  ...RELEVANCE_PARAMETERS,
  ...DATETIME_KEYWORDS,
  ...LOGICAL_KEYWORDS,
  ...COMPARISON_KEYWORDS,
  ...ARGUMENT_KEYWORDS,
  ...COMMAND_ASSIST_KEYWORDS,
  ...PARAMETERS_WITH_BOOLEAN_VALUES,
  ...JOIN_TYPE,
  ...PATTERNS_PARAMETERS,
  ...PATTERN_METHODS,
  ...PATTERN_MODES,
  ...KMEANS_PARAMETERS,
  ...AD_PARAMETERS,
  ...FILLNULL_PARAMETERS,
  LEFT_HINT,
  RIGHT_HINT,
  OUTER,
  APPEND,
];

// FUNCTIONS
const MATHEMATICAL_FUNCTION = [
  'abs',
  'cbrt',
  'ceil',
  'ceiling',
  'conv',
  'crc32',
  'e',
  'exp',
  'floor',
  'ln',
  'log',
  'log10',
  'log2',
  'mod',
  'pi',
  'pow',
  'sign',
  'position',
  'power',
  'rand',
  'round',
  'sqrt',
  'truncate',
];

export const TRIGONOMETRIC_FUNCTIONS = [
  'acos',
  'asin',
  'atan',
  'atan2',
  'cos',
  'cot',
  'degrees',
  'radians',
  'sin',
  'tan',
];

export const DATE_TIME_FUNCTIONS = [
  'adddate',
  'addtime',
  'curdate',
  'current_date',
  'current_time',
  'current_timestamp',
  'curtime',
  'date',
  'datediff',
  'date_add',
  'date_format',
  'date_sub',
  'dayname',
  'dayofmonth',
  'dayofweek',
  'dayofyear',
  'day_of_month',
  'day_of_week',
  'duration',
  'extract',
  'from_days',
  'from_unixtime',
  'get_format',
  'last_day',
  'localtime',
  'localtimestamp',
  'makedate',
  'maketime',
  'monthname',
  'now',
  'period_add',
  'period_diff',
  'sec_to_time',
  'str_to_date',
  'subdate',
  'subtime',
  'sysdate',
  'time',
  'timediff',
  'timestamp',
  'timestampadd',
  'timestampdiff',
  'time_format',
  'time_to_sec',
  'to_days',
  'to_seconds',
  'unix_timestamp',
  'utc_date',
  'utc_time',
  'utc_timestamp',
  'weekday',
  'yearweek',
];

const CRYPOGRAPHIC_FUNCTIONS = ['md5', 'sha1', 'sha2'];

export const TEXT_FUNCTIONS = [
  'substr',
  'substring',
  'ltrim',
  'rtrim',
  'trim',
  'to',
  'lower',
  'upper',
  'concat',
  'concat_ws',
  'length',
  'strcmp',
  'right',
  'left',
  'ascii',
  'locate',
  'replace',
  'reverse',
  'cast',
];

export const RELEVANCE_FUNCTIONS = [
  'match',
  'match_phrase',
  'match_phrase_prefix',
  'match_bool_prefix',
  'simple_query_string',
  'multi_match',
  'query_string',
];

export const SPAN = 'span';

const GEOIP = 'geoip';
const TYPEOF = 'typeof';
export const POSITION = 'position';
export const TAKE = 'take';
export const CONDITION_FUNCTIONS = ['like', 'isnull', 'isnotnull', 'cidrmatch', 'ispresent', 'isempty', 'isblank'];
export const SORT_FIELD_FUNCTIONS = ['auto', 'str', 'ip', 'num'];
const COLLECTION_FUNCTION = ['array', 'array_length', 'forall', 'exists', 'filter', 'transform', 'reduce'];
const JSON_FUNCTIONS = [
  'json_valid',
  'json',
  'json_object',
  'json_array',
  'json_array_length',
  'json_extract',
  'json_keys',
  'json_set',
  'json_delete',
  'json_append',
  'json_extend',
];
const FLOW_CONTROL_FUNCTIONS = ['ifnull', 'nullif', 'if', 'typeof', 'coalesce'];
export const PPL_FUNCTIONS = [
  ...TRIGONOMETRIC_FUNCTIONS,
  ...DATE_TIME_FUNCTIONS,
  ...TEXT_FUNCTIONS,
  ...MATHEMATICAL_FUNCTION,
  ...TRIGONOMETRIC_FUNCTIONS,
  ...RELEVANCE_FUNCTIONS,
];
export const EVAL_FUNCTIONS: string[] = [
  ...PPL_FUNCTIONS,
  ...COLLECTION_FUNCTION,
  ...JSON_FUNCTIONS,
  ...CRYPOGRAPHIC_FUNCTIONS,
  ...FLOW_CONTROL_FUNCTIONS,
  POSITION,
  GEOIP,
  TYPEOF,
];
export const SCALAR_FUNCTIONS = [
  'row_number',
  'rank',
  'dense_rank',
  'percent_rank',
  'cume_dist',
  'first',
  'last',
  'nth',
  'ntile',
];
export const STATS_FUNCTIONS = [
  'avg',
  'count',
  'sum',
  'min',
  'max',
  'stddev_samp',
  'var_samp',
  'var_pop',
  'stddev_pop',
  'percentile',
  'percentile_approx',
  'distinct_count',
  'distinct_count_approx',
  'earliest',
  'latest',
];
export const WINDOW_STATS_FUNCTIONS = [...STATS_FUNCTIONS, ...SCALAR_FUNCTIONS];

export const ALL_FUNCTIONS = [
  ...PPL_FUNCTIONS,
  ...STATS_FUNCTIONS,
  ...CONDITION_FUNCTIONS,
  ...SORT_FIELD_FUNCTIONS,
  ...SCALAR_FUNCTIONS,
  ...EVAL_FUNCTIONS,
  SPAN,
];

// OPERATORS
export const PLUS = '+';
export const MINUS = '-';
export const NOT = 'not';

export const FIELD_OPERATORS = [PLUS, MINUS];
export const ARITHMETIC_OPERATORS = [PLUS, MINUS, '*', '/', '%'];
export const COMPARISON_OPERATORS = ['>', '>=', '<', '!=', '<=', '='];
export const LOGICAL_EXPRESSION_OPERATORS = ['and', 'or', 'xor', NOT];
const BIT_OPERATORS = ['~', '&', '^'];
export const PPL_OPERATORS = [
  ...ARITHMETIC_OPERATORS,
  ...LOGICAL_EXPRESSION_OPERATORS,
  ...COMPARISON_OPERATORS,
  ...BIT_OPERATORS,
];

export const language: OpenSearchPPLLanguage = {
  defaultToken: '',
  id: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID,
  ignoreCase: true,
  commands: PPL_COMMANDS,
  operators: PPL_OPERATORS,
  keywords: ALL_KEYWORDS,
  builtinFunctions: ALL_FUNCTIONS,
  brackets: [{ open: '(', close: ')', token: 'delimiter.parenthesis' }],
  tokenizer: {
    root: [
      { include: '@comments' },
      { include: '@regexes' },
      { include: '@whitespace' },
      { include: '@variables' },
      { include: '@strings' },
      { include: '@numbers' },

      [/[,.:]/, 'delimiter'],
      [/\|/, 'delimiter.pipe'],
      [/[()\[\]]/, 'delimiter.parenthesis'],

      [
        /[\w@#$]+/,
        {
          cases: {
            '@commands': 'keyword.command',
            '@keywords': 'keyword',
            '@builtinFunctions': 'predefined',
            '@operators': 'operator',
            '@default': 'identifier',
          },
        },
      ],
      [/[+\-*/^%=!<>]/, 'operator'], // handles the math operators
      [/[,.:]/, 'operator'],
    ],
    // template variable syntax
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
      [/`/, { token: 'string.backtick', next: '@string_backtick' }],
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
    string_backtick: [
      [/[^\\`]+/, 'string.backtick'],
      [/`/, 'string.backtick', '@pop'],
    ],
    regexes: [[/\/.*?\/(?!\s*\d)/, 'regexp']],
  },
};

export const conf: monacoType.languages.LanguageConfiguration = {
  brackets: [['(', ')']],
  autoClosingPairs: [
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
  ],
  surroundingPairs: [
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
  ],
};
