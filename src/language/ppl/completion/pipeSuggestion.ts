import { LinkedToken } from '../../monarch/LinkedToken';
import { BY, COMPARISON_OPERATORS, CONDITION_FUNCTIONS, EVENTSTATS, FIELDS, SORT, STATS, WHERE } from '../language';
import { PPLTokenTypes } from '../tokenTypes';

/**
 * True when the cursor is in whitespace after a completed fields/sort/where/stats
 * clause and `|` is a reasonable next suggestion. Conservative: ambiguous → false.
 */
export function canSuggestPipe(currentToken: LinkedToken | null): boolean {
  if (!currentToken?.isWhiteSpace()) {
    return false;
  }

  const command = currentToken.getPreviousOfType(PPLTokenTypes.Command)?.value?.toLowerCase();
  if (!command) {
    return false;
  }

  const prev = currentToken.getPreviousNonWhiteSpaceToken();
  if (!prev) {
    return false;
  }

  switch (command) {
    case FIELDS:
    case SORT:
      return isFieldNameToken(prev, command === SORT);
    case WHERE:
      return isCompleteWhereClause(prev);
    case STATS:
    case EVENTSTATS:
      return isCompleteStatsClause(prev, currentToken);
    default:
      return false;
  }
}

function isFieldNameToken(token: LinkedToken, allowNumber: boolean): boolean {
  return token.isIdentifier() || token.is(PPLTokenTypes.Backtick) || (allowNumber && token.isNumber());
}

function isValueLikeToken(token: LinkedToken): boolean {
  return token.isIdentifier() || token.isNumber() || token.isString() || token.is(PPLTokenTypes.Backtick);
}

function isCompleteWhereClause(prev: LinkedToken): boolean {
  if (prev.is(PPLTokenTypes.Parenthesis, ')')) {
    const fn = prev.getPreviousOfType(PPLTokenTypes.Function)?.value?.toLowerCase();
    return !!fn && CONDITION_FUNCTIONS.includes(fn);
  }

  if (!isValueLikeToken(prev)) {
    return false;
  }

  const beforeValue = prev.getPreviousNonWhiteSpaceToken();
  return !!beforeValue && COMPARISON_OPERATORS.includes(beforeValue.value);
}

function isCompleteStatsClause(prev: LinkedToken, currentToken: LinkedToken): boolean {
  if (prev.is(PPLTokenTypes.Parenthesis, ')')) {
    return true;
  }

  if (!isFieldNameToken(prev, false)) {
    return false;
  }

  const byKeyword = currentToken.getPreviousOfType(PPLTokenTypes.Keyword, BY);
  return byKeyword != null;
}
