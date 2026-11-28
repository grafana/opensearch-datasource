import { StatementPosition } from 'language/monarch/types';
import { LinkedToken } from '../../monarch/LinkedToken';
import { SQLTokenTypes } from '../tokenTypes';
import { SQL_KEYWORDS } from '../language';

// getSQLStatementPosition returns the coarse 'statement position' of the cursor.
// It finds the nearest preceding keyword (walking backwards) so completions can
// react to the clause the cursor is currently inside.
export const getSQLStatementPosition = (currentToken: LinkedToken | null): StatementPosition => {
  // True start of query (empty / whitespace-only) — suggest keywords and index names.
  if (
    currentToken === null ||
    (currentToken?.isWhiteSpace() && !currentToken?.getPreviousNonWhiteSpaceToken())
  ) {
    return StatementPosition.SQLStartOfQuery;
  }

  // Inside parentheses -> treat as a general expression / function-arg context.
  if (currentToken?.isParenthesis()) {
    return StatementPosition.SQLExpression;
  }

  // Normalize to the previous significant token when the cursor sits on whitespace.
  const previous = currentToken?.getPreviousNonWhiteSpaceToken();

  // Right after an '=' operator -> suggest field values.
  if (previous?.type === SQLTokenTypes.Operator && previous.value === '=') {
    return StatementPosition.SQLAfterComparisonOperator;
  }

  // Walk backwards to find the nearest preceding keyword.
  let lastKeyword: string | null = null;
  let contentSinceKeyword = false;

  let curr: LinkedToken | null = previous ?? currentToken;
  while (curr != null) {
    if (!curr.isWhiteSpace()) {
      if (curr.isKeyword()) {
        lastKeyword = curr.value.toUpperCase();
        break; // nearest keyword found
      }
      contentSinceKeyword = true;
    }
    curr = curr.previous;
  }

  // "GROUP BY" / "ORDER BY" (two-word clauses) -> suggest fields.
  if (lastKeyword === 'GROUP' || lastKeyword === 'ORDER' || lastKeyword === 'BY') {
    return StatementPosition.SQLAfterByClause;
  }

  if (lastKeyword === 'WHERE') {
    return StatementPosition.SQLAfterWhereClause;
  }

  if (lastKeyword === 'FROM' || lastKeyword === 'JOIN') {
    return contentSinceKeyword
      ? StatementPosition.SQLAfterFromClauseComplete
      : StatementPosition.SQLAfterFromClause;
  }

  if (lastKeyword === 'SELECT') {
    return StatementPosition.SQLAfterSelect;
  }

  return StatementPosition.SQLExpression;
};

// isSQLKeyword helper used by completions.
export const isSQLKeyword = (value: string): boolean => {
  return SQL_KEYWORDS.includes(value.toLowerCase());
};
