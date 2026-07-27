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

  const commandToken = currentToken.getPreviousOfType(PPLTokenTypes.Command);
  const command = commandToken?.value?.toLowerCase();
  if (!commandToken || !command) {
    return false;
  }

  // Only treat this as a top-level pipe-stage command when nothing but a pipe (or the
  // start of the query) precedes it. Some commands (e.g. TRENDLINE) have their own
  // sub-syntax that reuses command keywords like SORT internally; those aren't real
  // pipe-stage boundaries and shouldn't be treated as suggestable-pipe positions.
  const beforeCommand = commandToken.getPreviousNonWhiteSpaceToken();
  if (beforeCommand && !beforeCommand.is(PPLTokenTypes.Pipe)) {
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
  if (token.isIdentifier() || token.is(PPLTokenTypes.Backtick) || (allowNumber && token.isNumber())) {
    return true;
  }

  // A field whose name collides with a builtin PPL function (e.g. `count`, `timestamp`)
  // is tokenized as Function/`predefined` rather than Identifier. Treat it as a field
  // name as long as it isn't actually being called, i.e. not immediately followed by `(`.
  if (token.isFunction()) {
    return !token.getNextNonWhiteSpaceToken()?.is(PPLTokenTypes.Parenthesis, '(');
  }

  return false;
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
