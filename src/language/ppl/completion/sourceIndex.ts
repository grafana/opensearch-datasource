import { LinkedToken } from '../../monarch/LinkedToken';
import { INDEX, SEARCH, SOURCE } from '../language';
import { PPLTokenTypes } from '../tokenTypes';

/**
 * Returns the index/pattern from a completed `source = <index>` or `index = <index>` clause, if present.
 * Joins identifier/number/keyword/command segments across `-` / `.` to match real PPL tokenization
 * (e.g. `logs-2024`, `my.index`, `logs-by-day`). Incomplete or missing clauses return undefined.
 *
 * Only from-clause `source=` / `index=` count (query start or after `search`), not e.g. `where index =`.
 * Both forms are valid in OpenSearchPPLParser fromClause (INDEX EQUAL is a synonym for SOURCE EQUAL).
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
          return collectJoinedName(indexStart, { allowStar: true, allowCommand: true });
        }
      }
    }
    token = token.next;
  }

  return undefined;
}

/** True when this token is part of a completed `source=` / `index=` index name. */
export function isTokenAfterFromIndexName(token: LinkedToken): boolean {
  return findFromEqualsBeforeIndexName(token) !== null && !isNameSeparator(token);
}

/** True when this token is a trailing `-` / `.` still inside an incomplete from-index name. */
export function isTokenIncompleteFromIndexName(token: LinkedToken): boolean {
  return findFromEqualsBeforeIndexName(token) !== null && isNameSeparator(token);
}

/**
 * Collects the field name immediately before a comparison operator, joining hyphenated/dotted
 * segments the way the Monarch tokenizer splits them (e.g. `user-id` → user, -, id).
 */
export function getFieldNameBeforeComparison(comparisonToken: LinkedToken): string | null {
  const endToken = comparisonToken.getPreviousNonWhiteSpaceToken();
  if (!endToken) {
    return null;
  }

  if (endToken.is(PPLTokenTypes.Backtick)) {
    return endToken.value.replace(/^`|`$/g, '');
  }

  let start: LinkedToken | null = endToken;
  while (start.previous) {
    const prev: LinkedToken = start.previous;
    if (prev.isWhiteSpace()) {
      break;
    }
    if (isFieldNamePart(prev) || isNameSeparator(prev)) {
      start = prev;
      continue;
    }
    break;
  }

  if (!start || !isFieldNamePart(start)) {
    return null;
  }

  return collectJoinedName(start, { allowStar: false, allowCommand: false }) ?? null;
}

/** `source` / `index` at query start or immediately after `search`. */
export function isFromClauseKeyword(token: LinkedToken): boolean {
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
  return isFieldNamePart(token) || token.is(PPLTokenTypes.Command) || token.is(PPLTokenTypes.Operator, '*');
}

function isFieldNamePart(token: LinkedToken): boolean {
  return token.isIdentifier() || token.isNumber() || token.isKeyword();
}

function canStartJoinedName(token: LinkedToken, allowCommand: boolean): boolean {
  return (
    token.isIdentifier() || token.isNumber() || token.isKeyword() || (allowCommand && token.is(PPLTokenTypes.Command))
  );
}

function isNameSeparator(token: LinkedToken): boolean {
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
    if (isIndexNamePart(prev) || isNameSeparator(prev)) {
      curr = prev;
      continue;
    }
    break;
  }

  if (!curr || (!isIndexNamePart(curr) && !isNameSeparator(curr))) {
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
 * Collects a joined name starting at the first segment token.
 * Returns undefined if the name is missing or ends with a dangling `-` / `.`.
 */
function collectJoinedName(
  startToken: LinkedToken,
  opts: { allowStar: boolean; allowCommand: boolean }
): string | undefined {
  if (!canStartJoinedName(startToken, opts.allowCommand)) {
    return undefined;
  }

  const isPart = (t: LinkedToken) =>
    t.isIdentifier() ||
    t.isNumber() ||
    t.isKeyword() ||
    (opts.allowCommand && t.is(PPLTokenTypes.Command)) ||
    (opts.allowStar && t.is(PPLTokenTypes.Operator, '*'));

  let name = startToken.value;
  let token: LinkedToken | null = startToken.next;

  while (token) {
    if (token.isWhiteSpace()) {
      break;
    }
    if (isNameSeparator(token)) {
      const next = token.next;
      if (next && isPart(next) && !next.is(PPLTokenTypes.Operator, '*')) {
        name += token.value + next.value;
        token = next.next;
        continue;
      }
      // Trailing separator → incomplete
      return undefined;
    }
    if (opts.allowStar && token.is(PPLTokenTypes.Operator, '*')) {
      name += token.value;
      token = token.next;
      continue;
    }
    break;
  }

  return name;
}
