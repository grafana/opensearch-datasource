import { LinkedToken } from '../../monarch/LinkedToken';
import { BY, COMPARISON_OPERATORS, CONDITION_FUNCTIONS, EVENTSTATS, FIELDS, SORT, STATS, WHERE } from '../language';
import { PPLTokenTypes } from '../tokenTypes';

/**
 * True when `|` is a reasonable next suggestion after a completed
 * fields/sort/where/stats clause. Conservative: ambiguous → false.
 *
 * The cursor may sit in trailing whitespace or still on the last token of the
 * clause (no trailing space yet).
 */
export function canSuggestPipe(currentToken: LinkedToken | null): boolean {
  if (!currentToken) {
    return false;
  }

  const clauseEnd = currentToken.isWhiteSpace() ? currentToken.getPreviousNonWhiteSpaceToken() : currentToken;
  if (!clauseEnd) {
    return false;
  }

  const commandToken = clauseEnd.is(PPLTokenTypes.Command)
    ? clauseEnd
    : clauseEnd.getPreviousOfType(PPLTokenTypes.Command);
  const command = commandToken?.value?.toLowerCase();
  if (!commandToken || !command) {
    return false;
  }

  // Only treat this as a top-level pipe-stage command when nothing but a pipe, the
  // start of a bracketed subquery (e.g. `appendcol ... [stats ...`), or the start of
  // the query precedes it. Some commands (e.g. TRENDLINE) have their own sub-syntax
  // that reuses command keywords like SORT internally; those aren't real pipe-stage
  // boundaries and shouldn't be treated as suggestable-pipe positions.
  const beforeCommand = commandToken.getPreviousNonWhiteSpaceToken();
  const isSubqueryOpener =
    !!beforeCommand &&
    (beforeCommand.is(PPLTokenTypes.Parenthesis, '[') || beforeCommand.is(PPLTokenTypes.Parenthesis, '[]'));
  if (beforeCommand && !beforeCommand.is(PPLTokenTypes.Pipe) && !isSubqueryOpener) {
    return false;
  }

  switch (command) {
    case FIELDS:
    case SORT:
      return isFieldNameToken(clauseEnd, command === SORT);
    case WHERE:
      return isCompleteWhereClause(clauseEnd);
    case STATS:
    case EVENTSTATS:
      return isCompleteStatsClause(clauseEnd);
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

function isCompleteStatsClause(clauseEnd: LinkedToken): boolean {
  if (clauseEnd.is(PPLTokenTypes.Parenthesis, ')')) {
    return true;
  }

  if (!isFieldNameToken(clauseEnd, false)) {
    return false;
  }

  return clauseEnd.getPreviousOfType(PPLTokenTypes.Keyword, BY) != null;
}
