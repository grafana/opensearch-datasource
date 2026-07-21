import { LinkedToken } from '../../monarch/LinkedToken';
import { INDEX, SEARCH, SOURCE } from '../language';
import { PPLTokenTypes } from '../tokenTypes';

/**
 * Returns the index/pattern from a completed `source = <index>` or `index = <index>` clause, if present.
 * Joins identifier/number/keyword/command segments across `-` / `.` to match real PPL tokenization
 * (e.g. `logs-2024`, `my.index`, `logs-by-day`). Incomplete or missing clauses return undefined.
 *
 * Only from-clause `source=` / `index=` count (query start or after `search`), not e.g. `where index =`.
 */
export function getSourceIndexFromTokens(currentToken: LinkedToken | null): string | undefined {
  if (!currentToken) {
    return undefined;
  }

  let token: LinkedToken | null = currentToken;
  while (token.previous) {
    token = token.previous;
  }

  while (token) {
    if (isFromClauseKeyword(token)) {
      const equalsToken = token.getNextNonWhiteSpaceToken();
      if (equalsToken?.is(PPLTokenTypes.Operator, '=')) {
        const indexStart = equalsToken.getNextNonWhiteSpaceToken();
        if (indexStart) {
          return collectIndexName(indexStart);
        }
      }
    }
    token = token.next;
  }

  return undefined;
}

/** True when this token is part of a completed `source=` / `index=` index name. */
export function isTokenAfterFromIndexName(token: LinkedToken): boolean {
  return findFromEqualsBeforeIndexName(token) !== null && !isIndexNameSeparator(token);
}

/** True when this token is a trailing `-` / `.` still inside an incomplete from-index name. */
export function isTokenIncompleteFromIndexName(token: LinkedToken): boolean {
  return findFromEqualsBeforeIndexName(token) !== null && isIndexNameSeparator(token);
}

/** `source` / `index` at query start or immediately after `search`. */
function isFromClauseKeyword(token: LinkedToken): boolean {
  const keyword = token.value?.toLowerCase();
  if (!token.is(PPLTokenTypes.Keyword) || (keyword !== SOURCE && keyword !== INDEX)) {
    return false;
  }
  const prev = token.getPreviousNonWhiteSpaceToken();
  if (!prev) {
    return true;
  }
  return prev.is(PPLTokenTypes.Command) && prev.value?.toLowerCase() === SEARCH;
}

function isIndexNamePart(token: LinkedToken): boolean {
  return (
    token.isIdentifier() ||
    token.isNumber() ||
    token.isKeyword() ||
    token.is(PPLTokenTypes.Command) ||
    token.is(PPLTokenTypes.Operator, '*')
  );
}

function canStartIndexName(token: LinkedToken): boolean {
  return token.isIdentifier() || token.isNumber() || token.isKeyword() || token.is(PPLTokenTypes.Command);
}

function isIndexNameSeparator(token: LinkedToken): boolean {
  return (
    token.is(PPLTokenTypes.Operator, '-') ||
    token.is(PPLTokenTypes.Delimiter, '.') ||
    token.is(PPLTokenTypes.Operator, '.')
  );
}

/**
 * Walks back from a token inside an index name to the `=` of a from-clause `source=` / `index=`, if any.
 */
function findFromEqualsBeforeIndexName(token: LinkedToken): LinkedToken | null {
  let curr: LinkedToken | null = token;

  while (curr?.previous) {
    const prev: LinkedToken = curr.previous;
    if (prev.isWhiteSpace()) {
      break;
    }
    if (isIndexNamePart(prev) || isIndexNameSeparator(prev)) {
      curr = prev;
      continue;
    }
    break;
  }

  if (!curr || (!isIndexNamePart(curr) && !isIndexNameSeparator(curr))) {
    return null;
  }

  const equalsToken = curr.getPreviousNonWhiteSpaceToken();
  if (!equalsToken?.is(PPLTokenTypes.Operator, '=')) {
    return null;
  }
  const keywordToken = equalsToken.getPreviousNonWhiteSpaceToken();
  if (!keywordToken || !isFromClauseKeyword(keywordToken)) {
    return null;
  }
  return equalsToken;
}

/**
 * Collects a full index/pattern starting at the first name token after `=`.
 * Returns undefined if the name is missing or ends with a dangling `-` / `.`.
 */
function collectIndexName(startToken: LinkedToken): string | undefined {
  if (!canStartIndexName(startToken)) {
    return undefined;
  }

  let name = startToken.value;
  let token: LinkedToken | null = startToken.next;

  while (token) {
    if (token.isWhiteSpace()) {
      break;
    }
    if (isIndexNameSeparator(token)) {
      const next = token.next;
      if (next && isIndexNamePart(next)) {
        name += token.value + next.value;
        token = next.next;
        continue;
      }
      // Trailing separator → incomplete
      return undefined;
    }
    if (token.is(PPLTokenTypes.Operator, '*')) {
      name += token.value;
      token = token.next;
      continue;
    }
    break;
  }

  return name;
}
