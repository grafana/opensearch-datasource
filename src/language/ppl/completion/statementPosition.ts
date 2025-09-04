import { StatementPosition } from 'language/monarch/types';
import { LinkedToken } from '../../monarch/LinkedToken';
import {
  ARITHMETIC_OPERATORS,
  PARAMETERS_WITH_BOOLEAN_VALUES,
  BY,
  COMPARISON_OPERATORS,
  CONDITION_FUNCTIONS,
  DEDUP,
  EVAL,
  EVENTSTATS,
  FIELD_OPERATORS,
  FIELDS,
  HEAD,
  IN,
  LOGICAL_EXPRESSION_OPERATORS,
  NOT,
  RARE,
  SORT,
  SORT_FIELD_FUNCTIONS,
  SPAN,
  STATS,
  STATS_FUNCTIONS,
  TOP,
  WHERE,
  PARSE,
  BETWEEN,
  EVAL_FUNCTIONS,
  SEARCH,
  INDEX,
  SOURCE,
  JOIN,
  ON,
  RENAME,
  AS,
  GROK,
  PATTERNS,
  METHOD,
  MODE,
  PATTERNS_PARAMETER_LITERAL,
  LOOKUP,
  APPEND,
  REPLACE,
  KMEANS,
  AD,
  USING,
  WITH,
  FILLNULL,
  TRENDLINE,
  APPENDCOL,
  EXPAND,
  FLATTEN,
  REVERSE,
} from '../language';
import { PPLTokenTypes } from '../tokenTypes';

// getStatementPosition returns the 'statement position' of the place where the cursor is currently positioned.
// Statement positions are places that are syntactically and relevant for the evaluated language and are used to determine the suggestionKinds, i.e.
// suggestions in the dropdown.
// For example, in PPL, if the cursor is currently at the whitespace after the WHERE keyword, this function returns StatementPosition.BeforeLogicalExpression.
// In getSuggestionKinds, this position will result in SuggestionKind.LogicalExpression.
// Lastly, In PPLCompletionItemProvider appropriate suggestions of logical operators are added to the dropdown based on the suggestion kind.

export const getStatementPosition = (currentToken: LinkedToken | null): StatementPosition => {
  const previousNonWhiteSpace = currentToken?.getPreviousNonWhiteSpaceToken();
  const nextNonWhiteSpace = currentToken?.getNextNonWhiteSpaceToken();

  const normalizedPreviousNonWhiteSpace = previousNonWhiteSpace?.value?.toLowerCase();

  if (
    currentToken === null ||
    (currentToken?.isWhiteSpace() && previousNonWhiteSpace === null && nextNonWhiteSpace === null) ||
    (previousNonWhiteSpace?.is(PPLTokenTypes.Pipe) && currentToken?.isWhiteSpace()) ||
    previousNonWhiteSpace?.is(PPLTokenTypes.Delimiter, '|')
  ) {
    return StatementPosition.NewCommand;
  }

  switch (normalizedPreviousNonWhiteSpace) {
    case SEARCH:
      return StatementPosition.AfterSearchCommand;
    case WHERE:
      return StatementPosition.BeforeLogicalExpression;
    case DEDUP:
      return StatementPosition.FieldList;
    case FIELDS:
      return StatementPosition.AfterFieldsCommand;
    case EVENTSTATS:
      return StatementPosition.AfterEventStatsCommand;
    case STATS:
      return StatementPosition.AfterStatsCommand;
    case SORT:
      return StatementPosition.SortField;
    case PARSE:
      return StatementPosition.Expression;
  }

  if (
    currentToken?.isWhiteSpace() ||
    currentToken?.is(PPLTokenTypes.Backtick) ||
    currentToken?.is(PPLTokenTypes.Delimiter, ',') ||
    currentToken?.is(PPLTokenTypes.Parenthesis) // for STATS functions
  ) {
    const nearestFunction = currentToken?.getPreviousOfType(PPLTokenTypes.Function)?.value.toLowerCase();
    const nearestKeyword = currentToken?.getPreviousOfType(PPLTokenTypes.Keyword)?.value.toLowerCase();
    const nearestCommand = getNearestCommand(currentToken);

    if (normalizedPreviousNonWhiteSpace) {
      if (
        nearestCommand !== FIELDS && // FIELDS and SORT fields can be preceeded by a + or - which are not arithmetic ops
        nearestCommand !== SORT &&
        ARITHMETIC_OPERATORS.includes(normalizedPreviousNonWhiteSpace)
      ) {
        return StatementPosition.AfterArithmeticOperator;
      }
      if (PARAMETERS_WITH_BOOLEAN_VALUES.includes(normalizedPreviousNonWhiteSpace)) {
        return StatementPosition.AfterBooleanArgument;
      }
    }

    const isBeforeLogicalExpression =
      (normalizedPreviousNonWhiteSpace &&
        (COMPARISON_OPERATORS.includes(normalizedPreviousNonWhiteSpace) ||
          LOGICAL_EXPRESSION_OPERATORS.includes(normalizedPreviousNonWhiteSpace))) ||
      previousNonWhiteSpace?.is(PPLTokenTypes.Regexp) ||
      normalizedPreviousNonWhiteSpace === NOT || // follows a comparison operator, logical operator, NOT or a regex
      (nearestFunction && CONDITION_FUNCTIONS.includes(nearestFunction) && normalizedPreviousNonWhiteSpace === ')'); // it's not a condition function argument

    if (
      canListFields(nearestCommand) && // commands that can be followed by a field list
      (isListingFields(currentToken) || currentToken?.is(PPLTokenTypes.Backtick))
    ) {
      return StatementPosition.FieldList;
    }

    if (
      canHaveLogicalExpr(nearestCommand) && // appendcol only has boolean after equal
      isBeforeLogicalExpression
    ) {
      return StatementPosition.BeforeLogicalExpression;
    }
    if (nearestKeyword) {
      switch (nearestKeyword) {
        case INDEX:
        case SOURCE: {
          return StatementPosition.BeforeLogicalExpression;
        }
        case IN: {
          if (nearestCommand !== FILLNULL) {
            // fillnull only has fieldList after IN keyword, not value expression
            return StatementPosition.AfterINKeyword;
          }
          break;
        }
        case BETWEEN: {
          return StatementPosition.FunctionArg;
        }
      }
    }

    if (
      nearestFunction &&
      (currentToken?.is(PPLTokenTypes.Parenthesis) || currentToken?.getNextNonWhiteSpaceToken()?.value === ')')
    ) {
      if (nearestCommand !== PATTERNS && [...EVAL_FUNCTIONS, ...CONDITION_FUNCTIONS].includes(nearestFunction)) {
        return StatementPosition.FunctionArg;
      }
      if (STATS_FUNCTIONS.includes(nearestFunction)) {
        return StatementPosition.StatsFunctionArgument;
      }
      if (SORT_FIELD_FUNCTIONS.includes(nearestFunction)) {
        return StatementPosition.SortFieldExpression;
      }
    }

    switch (nearestCommand) {
      case SORT: {
        if (previousNonWhiteSpace) {
          if (previousNonWhiteSpace.is(PPLTokenTypes.Delimiter, ',')) {
            return StatementPosition.SortField;
          } else if (FIELD_OPERATORS.includes(previousNonWhiteSpace.value)) {
            return StatementPosition.SortFieldExpression;
          }
        }
        break;
      }
      case DEDUP: {
        // if current active command is DEDUP and there are identifiers (fieldNames) between currentToken and the dedup command
        const fieldNames = currentToken.getPreviousUntil(PPLTokenTypes.Number, [
          PPLTokenTypes.Delimiter,
          PPLTokenTypes.Whitespace,
        ]);
        if (fieldNames?.length && !havePipe(fieldNames)) {
          return StatementPosition.AfterDedupFieldNames;
        }
        return StatementPosition.FieldList;
      }
      case FIELDS: {
        return StatementPosition.FieldList;
      }
      case STATS:
      case EVENTSTATS: {
        if (nearestKeyword === BY && currentToken.isWhiteSpace()) {
          return StatementPosition.AfterStatsBy;
        } else if (nearestFunction === SPAN && currentToken?.is(PPLTokenTypes.Parenthesis)) {
          return StatementPosition.FieldList;
        }
        return StatementPosition.AfterStatsCommand;
      }
      case RARE: {
        return StatementPosition.AfterRareCommand;
      }
      case TOP: {
        return StatementPosition.AfterTopCommand;
      }
      case HEAD:
        return StatementPosition.AfterHeadCommand;

      case EVAL:
        if (previousNonWhiteSpace?.value === '=') {
          return StatementPosition.BeforeLogicalExpression;
        }
        if (
          currentToken?.isWhiteSpace() &&
          (normalizedPreviousNonWhiteSpace === EVAL || previousNonWhiteSpace?.is(PPLTokenTypes.Delimiter, ','))
        ) {
          return StatementPosition.EvalClause;
        }
        if (isBeforeLogicalExpression) {
          return StatementPosition.BeforeLogicalExpression;
        }
        break;

      case JOIN:
        if (normalizedPreviousNonWhiteSpace === ON) {
          return StatementPosition.JoinCriteria;
        }
        return StatementPosition.AfterJoinCommand;

      case RENAME:
        if (previousNonWhiteSpace?.is(PPLTokenTypes.Identifier)) {
          return StatementPosition.BeforeAsClause;
        }
        if (normalizedPreviousNonWhiteSpace !== AS) {
          return StatementPosition.FieldList;
        }
        break;

      case GROK:
        if (previousNonWhiteSpace?.is(PPLTokenTypes.Command, GROK)) {
          return StatementPosition.FieldList;
        }
        break;

      case PATTERNS: {
        if (previousNonWhiteSpace?.is(PPLTokenTypes.Command, PATTERNS)) {
          return StatementPosition.AfterPatternsCommand;
        }
        const nextToLastNonWhiteSpace = previousNonWhiteSpace?.getPreviousNonWhiteSpaceToken();
        if (
          previousNonWhiteSpace?.is(PPLTokenTypes.Operator, '=') &&
          nextToLastNonWhiteSpace?.is(PPLTokenTypes.Identifier)
        ) {
          // follows a field =
          return StatementPosition.Expression;
        } else {
          if (previousNonWhiteSpace?.is(PPLTokenTypes.Keyword, BY)) {
            return StatementPosition.AfterStatsBy;
          } else if (nextToLastNonWhiteSpace?.is(PPLTokenTypes.Keyword, METHOD)) {
            return StatementPosition.AfterPatternMethod;
          } else if (nextToLastNonWhiteSpace?.is(PPLTokenTypes.Keyword, MODE)) {
            return StatementPosition.AfterPatternMode;
            // all other arguments are followed by literals
          } else if (previousNonWhiteSpace?.is(PPLTokenTypes.Operator, '=')) {
            if (nextToLastNonWhiteSpace && PATTERNS_PARAMETER_LITERAL.includes(nextToLastNonWhiteSpace?.value)) {
              return StatementPosition.Unknown;
            }
          }
        }
        return StatementPosition.PatternsArguments;
      }

      case LOOKUP:
        const nextToLastNonWhiteSpace = previousNonWhiteSpace?.getPreviousNonWhiteSpaceToken()?.value.toLowerCase();
        if (previousNonWhiteSpace?.is(PPLTokenTypes.Command, LOOKUP)) {
          return StatementPosition.Unknown;
        }
        if (nextToLastNonWhiteSpace === LOOKUP) {
          return StatementPosition.AfterLookupTableSource;
        }
        if (
          previousNonWhiteSpace?.is(PPLTokenTypes.Delimiter, ',') ||
          (normalizedPreviousNonWhiteSpace && [APPEND, REPLACE, AS].includes(normalizedPreviousNonWhiteSpace))
        ) {
          return StatementPosition.FieldList;
        }
        return StatementPosition.AfterLookupMappingList;

      case KMEANS:
        if (!previousNonWhiteSpace?.is(PPLTokenTypes.Operator, '=')) {
          return StatementPosition.AfterKmeansCommand;
        }
        break;
      case AD:
        if (!previousNonWhiteSpace?.is(PPLTokenTypes.Operator, '=')) {
          return StatementPosition.AfterAdCommand;
        }
        break;

      case FILLNULL:
        if (previousNonWhiteSpace?.is(PPLTokenTypes.Command, FILLNULL)) {
          return StatementPosition.AfterFillNullCommand;
        }
        if (previousNonWhiteSpace?.is(PPLTokenTypes.Keyword, IN) || currentToken?.is(PPLTokenTypes.Keyword, IN)) {
          return StatementPosition.FieldList;
        }
        if (nearestKeyword === WITH) {
          return StatementPosition.AfterFillNullWith;
        } else if (nearestKeyword === USING) {
          if (currentToken?.is(PPLTokenTypes.Operator, '=') || previousNonWhiteSpace?.is(PPLTokenTypes.Operator, '=')) {
            return StatementPosition.BeforeValueExpression;
          } else {
            return StatementPosition.BeforeFieldExpression;
          }
        }
        break;

      case TRENDLINE:
        if (!previousNonWhiteSpace?.is(PPLTokenTypes.Keyword, AS)) {
          if (previousNonWhiteSpace?.is(PPLTokenTypes.Command, TRENDLINE)) {
            return StatementPosition.AfterTrendlineCommand;
          }
          if (previousNonWhiteSpace?.is(PPLTokenTypes.Command, SORT)) {
            return StatementPosition.SortField;
          } else if (
            previousNonWhiteSpace?.is(PPLTokenTypes.Delimiter, ',') &&
            previousNonWhiteSpace?.getPreviousNonWhiteSpaceToken()?.is(PPLTokenTypes.Number)
          ) {
            return StatementPosition.BeforeFieldExpression;
          } else {
            return StatementPosition.TrendlineClause;
          }
        }
        break;

      case APPENDCOL:
        if (
          previousNonWhiteSpace?.is(PPLTokenTypes.Parenthesis, '[]') ||
          currentToken?.is(PPLTokenTypes.Parenthesis, '[')
        ) {
          return StatementPosition.NewCommand;
        }
        return StatementPosition.AfterAppendColCommand;

      case EXPAND:
      case FLATTEN:
        return StatementPosition.BeforeFieldExpression;

      case REVERSE:
        return StatementPosition.Unknown;
    }
  }

  return StatementPosition.Unknown;
};

const havePipe = (fieldNames: LinkedToken[]) => {
  return fieldNames?.some((word) => word.type === PPLTokenTypes.Pipe);
};
const isListingFields = (currentToken: LinkedToken | null) => {
  const tokensUntilFieldName = currentToken?.getPreviousUntil(PPLTokenTypes.Identifier, [PPLTokenTypes.Whitespace]); // tokens until exampleFieldName
  const tokensUntilEscapedFieldName = currentToken?.getPreviousUntil(PPLTokenTypes.Backtick, [
    // tokens until `@exampleFieldName`
    PPLTokenTypes.Whitespace,
  ]);
  const isPreceededByAFieldName =
    (tokensUntilFieldName?.length && tokensUntilFieldName.every((token) => token.is(PPLTokenTypes.Delimiter, ','))) ||
    (tokensUntilEscapedFieldName?.length &&
      tokensUntilEscapedFieldName.every((token) => token.is(PPLTokenTypes.Delimiter, ',')));
  const isAfterComma =
    currentToken?.isWhiteSpace() && currentToken?.getPreviousNonWhiteSpaceToken()?.is(PPLTokenTypes.Delimiter, ',');
  const isFunctionArgument = currentToken?.getNextNonWhiteSpaceToken()?.value === ')'; // is not e.g. span(`@timestamp`, 5m)

  return isAfterComma && isPreceededByAFieldName && !isFunctionArgument;
};

const getNearestCommand = (currentToken: LinkedToken | null): string | null => {
  const command = currentToken?.getPreviousOfType(PPLTokenTypes.Command);
  if (command?.value.toLowerCase() === SORT) {
    // SORT is a special case as it can be a command and an argument to the TRENDLINE command
    const previousCommand = command?.getPreviousOfType(PPLTokenTypes.Command)?.value.toLowerCase();
    if (previousCommand === TRENDLINE) {
      return TRENDLINE.toLowerCase();
    }
  }
  return command?.value.toLowerCase() ?? null;
};

const canHaveLogicalExpr = (nearestCommand: string | null): boolean => {
  return (
    nearestCommand !== KMEANS &&
    nearestCommand !== AD &&
    nearestCommand !== PATTERNS && // patterns, ad, kmeans only have literals after equal operator
    nearestCommand !== FILLNULL && // fillnull doesn't have LogicalExpression after equal operator
    nearestCommand !== EVAL && // eval can have StatementPosition.Expression after an equal operator
    nearestCommand !== JOIN && // join can have left/right hints agter join type which have comparison operator
    nearestCommand !== APPENDCOL
  );
};

const canListFields = (nearestCommand: string | null): boolean => {
  return (
    nearestCommand !== PATTERNS &&
    nearestCommand !== FLATTEN && // flatten commas can be followed by field expressions
    nearestCommand !== SORT && // sort command fields can be followed by a field operator, which is handled lower in the block
    nearestCommand !== STATS && // identifiers in STATS can be followed by a stats function, which is handled lower in the block
    nearestCommand !== EVAL // eval fields can be followed by an eval clause, which is handled lower in the block
  );
};
