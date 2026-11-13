import { isEqual } from 'lodash';
import lucene, { AST, BinaryAST, LeftOnlyAST, NodeTerm } from 'lucene';

import { AdHocVariableFilter, ToggleFilterAction, dateMath, dateTime } from '@grafana/data';

type ModifierType = '' | '-';

/**
 * Adds a label:"value" expression to the query.
 */
export function addLuceneAdHocFilter(query: string, filter: AdHocVariableFilter): string {
  if (!filter.key || !filter.value) {
    return query;
  }

  filter = {
    ...filter,
    // Type is defined as string, but it can be a number.
    value: filter.value.toString(),
  };

  const equalityFilters = ['=', '!='];
  if (equalityFilters.includes(filter.operator)) {
    return addAdHocFilterToLuceneQuery(query, filter.key, filter.value, filter.operator === '=' ? '' : '-');
  }
  /**
   * Keys and values in ad hoc filters may contain characters such as
   * colons, which needs to be escaped.
   */
  const key = escapeFilter(filter.key);
  const value = escapeFilterValue(filter.value);
  let addHocFilter = '';
  switch (filter.operator) {
    case '=~':
      addHocFilter = `${key}:/${value}/`;
      break;
    case '!~':
      addHocFilter = `-${key}:/${value}/`;
      break;
    case '>':
      addHocFilter = `${key}:>${value}`;
      break;
    case '<':
      addHocFilter = `${key}:<${value}`;
      break;
  }
  return concatenate(query, addHocFilter);
}

/**
 * Adds a label:"value" expression to the query.
 */
export function addAdHocFilterToLuceneQuery(
  query: string,
  key: string,
  value: string,
  modifier: ModifierType = ''
): string {
  if (luceneQueryHasFilter(query, key, value, modifier)) {
    return query;
  }

  key = escapeFilter(key);
  value = escapeFilterValue(value);
  const filter = `${modifier}${key}:"${value}"`;
  return concatenate(query, filter);
}

/**
 * Checks for the presence of a given label:"value" filter in the query.
 */
export function luceneQueryHasFilter(query: string, key: string, value: string, modifier: ModifierType = ''): boolean {
  return findFilterNode(query, key, value, modifier) !== null;
}

/**
 * Merge a query with a filter.
 */
function concatenate(query: string, filter: string, condition = 'AND'): string {
  if (!filter) {
    return query;
  }
  return query.trim() === '' ? filter : `${query} ${condition} ${filter}`;
}

/**
 * Removes a label:"value" expression from the query.
 */
export function removeFilterFromLuceneQuery(
  query: string,
  key: string,
  value: string,
  modifier: ModifierType = ''
): string {
  const node = findFilterNode(query, key, value, modifier);
  const ast = parseQuery(query);
  if (!node || !ast) {
    return query;
  }

  return lucene.toString(removeNodeFromTree(ast, node));
}

/**
 * Given a query, find the NodeTerm that matches the given field and value.
 */
export function findFilterNode(
  query: string,
  key: string,
  value: string,
  modifier: ModifierType = ''
): NodeTerm | null {
  const field = `${modifier}${lucene.term.escape(key)}`;
  value = lucene.phrase.escape(value);
  let ast: AST | null = parseQuery(query);
  if (!ast) {
    return null;
  }

  return findNodeInTree(ast, field, value);
}

function findNodeInTree(ast: AST, field: string, value: string): NodeTerm | null {
  // {}
  if (Object.keys(ast).length === 0) {
    return null;
  }
  // { left: {}, right: {} } or { left: {} }
  if (isAST(ast.left)) {
    return findNodeInTree(ast.left, field, value);
  }
  if (isNodeTerm(ast.left) && ast.left.field === field && ast.left.term === value) {
    return ast.left;
  }
  if (isLeftOnlyAST(ast)) {
    return null;
  }
  if (isNodeTerm(ast.right) && ast.right.field === field && ast.right.term === value) {
    return ast.right;
  }
  if (isBinaryAST(ast.right)) {
    return findNodeInTree(ast.right, field, value);
  }
  return null;
}

function removeNodeFromTree(ast: AST, node: NodeTerm): AST {
  // {}
  if (Object.keys(ast).length === 0) {
    return ast;
  }
  // { left: {}, right: {} } or { left: {} }
  if (isAST(ast.left)) {
    ast.left = removeNodeFromTree(ast.left, node);
    return ast;
  }
  if (isNodeTerm(ast.left) && isEqual(ast.left, node)) {
    Object.assign(
      ast,
      {
        left: undefined,
        operator: undefined,
        right: undefined,
      },
      'right' in ast ? ast.right : {}
    );
    return ast;
  }
  if (isLeftOnlyAST(ast)) {
    return ast;
  }
  if (isNodeTerm(ast.right) && isEqual(ast.right, node)) {
    Object.assign(ast, {
      right: undefined,
      operator: undefined,
    });
    return ast;
  }
  if (isBinaryAST(ast.right)) {
    ast.right = removeNodeFromTree(ast.right, node);
    return ast;
  }
  return ast;
}

/**
 * Filters can possibly reserved characters such as colons which are part of the Lucene syntax.
 * Use this function to escape filter keys.
 */
export function escapeFilter(value: string) {
  return lucene.term.escape(value);
}

/**
 * Values can possibly reserved special characters such as quotes.
 * Use this function to escape filter values.
 */
export function escapeFilterValue(value: string) {
  value = value.replace(/\\/g, '\\\\');
  return lucene.phrase.escape(value);
}

/**
 * Normalizes the query by removing whitespace around colons, which breaks parsing.
 */
function normalizeQuery(query: string) {
  return query.replace(/(\w+)\s(:)/gi, '$1$2');
}

function isLeftOnlyAST(ast: unknown): ast is LeftOnlyAST {
  if (!ast || typeof ast !== 'object') {
    return false;
  }

  if ('left' in ast && !('right' in ast)) {
    return true;
  }

  return false;
}

function isBinaryAST(ast: unknown): ast is BinaryAST {
  if (!ast || typeof ast !== 'object') {
    return false;
  }

  if ('left' in ast && 'right' in ast) {
    return true;
  }
  return false;
}

function isAST(ast: unknown): ast is AST {
  return isLeftOnlyAST(ast) || isBinaryAST(ast);
}

function isNodeTerm(ast: unknown): ast is NodeTerm {
  if (ast && typeof ast === 'object' && 'term' in ast) {
    return true;
  }

  return false;
}

function parseQuery(query: string) {
  try {
    return lucene.parse(normalizeQuery(query));
  } catch (e) {
    return null;
  }
}

export function addStringFilterToQuery(query: string, filter: string, contains = true) {
  const expression = `"${escapeFilterValue(filter)}"`;
  return query.trim() ? `${query} ${contains ? 'AND' : 'NOT'} ${expression}` : `${contains ? '' : 'NOT '}${expression}`;
}

function isNotANumber(value: string) {
  return isNaN(Number(value));
}

function getAdHocPPLQuery(filter: AdHocVariableFilter): string {
  let value = '';

  if ('=~' === filter.operator || '!~' === filter.operator) {
    return '';
  }
  if (dateMath.isValid(filter.value)) {
    const validTime = dateTime(filter.value).utc().format('YYYY-MM-DD HH:mm:ss.SSSSSS');
    value = `timestamp('${validTime}')`;
  } else if (typeof filter.value === 'string' && isNotANumber(filter.value)) {
    value = `'${filter.value}'`;
  } else {
    value = filter.value;
  }
  return `\`${filter.key}\` ${filter.operator} ${value}`;
}
export function addAdhocFilterToPPLQuery(queryString: any, filter: AdHocVariableFilter, i?: number): string {
  if (!filter.key || !filter.value) {
    return queryString;
  }
  const adHocQuery: string = getAdHocPPLQuery(filter);

  if (adHocQuery !== '') {
    if (queryString === '') {
      return adHocQuery;
    }
    // originally, the query string added '| where' to the query if the filter was the first filter;
    // however we have no way of knowing this since toggleQueryFilter called from Explore just passes the current filter
    // this should still work even though the filtering is a but different than the original implementation
    if (i && i > 0) {
      queryString += ' and ' + adHocQuery;
    } else {
      queryString += ' | where ' + adHocQuery;
    }
  }
  return queryString;
}
export function removeFilterFromPPLQuery(query: string, filter: AdHocVariableFilter): string {
  const adHocQuery: string = getAdHocPPLQuery(filter);
  return query.replace(` | where ${adHocQuery}`, '');
}
export function PPLQueryHasFilter(query: string, filter: AdHocVariableFilter): boolean {
  const adHocQuery: string = getAdHocPPLQuery(filter);
  return query.includes(adHocQuery);
}
/**
 * Finds the position of the first of the given keywords that appears at the top
 * level of the query, outside of a string literal and outside of parentheses.
 * A keyword inside a subquery or inside a literal is part of that construct and
 * not a clause of the query that is being modified.
 */
function findTopLevelKeyword(query: string, keywords: string[]): number {
  let depth = 0;
  let quote: string | null = null;

  for (let i = 0; i < query.length; i++) {
    const char = query[i];

    if (quote) {
      if (char === quote) {
        // A doubled quote is an escaped quote, not the end of the literal.
        if (query[i + 1] === quote) {
          i++;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') {
      depth++;
      continue;
    }
    if (char === ')') {
      depth--;
      continue;
    }
    if (depth !== 0) {
      continue;
    }

    const rest = query.slice(i).toUpperCase();
    for (const keyword of keywords) {
      if (!rest.startsWith(keyword)) {
        continue;
      }
      const before = i === 0 ? ' ' : query[i - 1];
      const after = query[i + keyword.length] ?? ' ';
      if (/\s/.test(before) && /\s/.test(after)) {
        return i;
      }
    }
  }

  return -1;
}

function sqlFilterValue(value: string): string {
  // A number is written as one, everything else is a string literal. A single
  // quote inside the value is escaped by doubling it.
  return isNotANumber(value) ? `'${value.replace(/'/g, "''")}'` : value;
}

function getAdHocSQLCondition(filter: AdHocVariableFilter): string {
  const key = `\`${filter.key}\``;
  const value = sqlFilterValue(filter.value);

  switch (filter.operator) {
    case '=':
    case '!=':
    case '>':
    case '<':
      return `${key} ${filter.operator} ${value}`;
    case '=~':
      return `${key} LIKE '%${filter.value.replace(/'/g, "''")}%'`;
    case '!~':
      return `${key} NOT LIKE '%${filter.value.replace(/'/g, "''")}%'`;
    default:
      return '';
  }
}

/**
 * Adds an ad hoc filter to a SQL query as a WHERE condition.
 *
 * Lucene appends `key:"value"` with AND, which SQL does not accept: AND only
 * joins conditions inside a WHERE clause. The condition is therefore added to
 * the WHERE clause, or a new one is inserted before the first clause that has to
 * follow it.
 */
export function addAdHocFilterToSQLQuery(query: string, filter: AdHocVariableFilter): string {
  if (!filter.key || !filter.value) {
    return query;
  }

  const condition = getAdHocSQLCondition(filter);
  if (condition === '') {
    return query;
  }

  const whereIdx = findTopLevelKeyword(query, ['WHERE']);
  if (whereIdx !== -1) {
    // The condition goes at the end of the WHERE clause, before the clause that
    // ends it.
    const endIdx = findTopLevelKeyword(query.slice(whereIdx), ['GROUP BY', 'ORDER BY', 'LIMIT', 'HAVING']);
    const insertAt = endIdx === -1 ? query.length : whereIdx + endIdx;
    return `${query.slice(0, insertAt).trimEnd()} AND ${condition} ${query.slice(insertAt).trimStart()}`.trimEnd();
  }

  const clauseIdx = findTopLevelKeyword(query, ['GROUP BY', 'ORDER BY', 'LIMIT', 'HAVING']);
  if (clauseIdx === -1) {
    return `${query.trimEnd()} WHERE ${condition}`;
  }

  return `${query.slice(0, clauseIdx).trimEnd()} WHERE ${condition} ${query.slice(clauseIdx)}`;
}

export function SQLQueryHasFilter(query: string, filter: AdHocVariableFilter): boolean {
  return query.includes(getAdHocSQLCondition(filter));
}

/**
 * Removes the condition an ad hoc filter added to a SQL query.
 *
 * The condition is removed together with the AND or the WHERE that joins it, so
 * the query is left as it was before the filter was added. The whole query is
 * returned unchanged when the condition is not found.
 */
export function removeFilterFromSQLQuery(query: string, filter: AdHocVariableFilter): string {
  const condition = getAdHocSQLCondition(filter);
  if (!condition || !query.includes(condition)) {
    return query;
  }

  return query
    .replace(new RegExp(`\\s+AND\\s+${escapeRegExp(condition)}`, 'g'), '')
    .replace(new RegExp(`\\s+WHERE\\s+${escapeRegExp(condition)}`, 'g'), '')
    .trimEnd();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function toggleQueryFilterForSQL(queryString: string, filter: ToggleFilterAction): string {
  let expression = queryString;
  switch (filter.type) {
    case 'FILTER_FOR': {
      const adHocFilter: AdHocVariableFilter = {
        key: filter.options.key,
        value: filter.options.value,
        operator: '=',
      };
      expression = SQLQueryHasFilter(expression, adHocFilter)
        ? removeFilterFromSQLQuery(expression, adHocFilter)
        : addAdHocFilterToSQLQuery(expression, adHocFilter);
      break;
    }
    case 'FILTER_OUT': {
      const adHocFilter: AdHocVariableFilter = {
        key: filter.options.key,
        value: filter.options.value,
        operator: '!=',
      };
      // If the opposite filter is present, remove it before adding the new one.
      const oppositeFilter: AdHocVariableFilter = { ...adHocFilter, operator: '=' };
      if (SQLQueryHasFilter(expression, oppositeFilter)) {
        expression = removeFilterFromSQLQuery(expression, oppositeFilter);
      }
      expression = addAdHocFilterToSQLQuery(expression, adHocFilter);
      break;
    }
  }
  return expression;
}

export function toggleQueryFilterForLucene(queryString: string, filter: ToggleFilterAction): string {
  let expression = queryString;
  switch (filter.type) {
    case 'FILTER_FOR': {
      // This gives the user the ability to toggle a filter on and off.
      expression = luceneQueryHasFilter(expression, filter.options.key, filter.options.value)
        ? removeFilterFromLuceneQuery(expression, filter.options.key, filter.options.value)
        : addAdHocFilterToLuceneQuery(expression, filter.options.key, filter.options.value);
      break;
    }
    case 'FILTER_OUT': {
      // If the opposite filter is present, remove it before adding the new one.
      if (luceneQueryHasFilter(expression, filter.options.key, filter.options.value)) {
        expression = removeFilterFromLuceneQuery(expression, filter.options.key, filter.options.value);
      }
      expression = addAdHocFilterToLuceneQuery(expression, filter.options.key, filter.options.value, '-');
      break;
    }
  }
  return expression;
}
export function toggleQueryFilterForPPL(queryString: string, filter: ToggleFilterAction): string {
  let expression = queryString;
  switch (filter.type) {
    case 'FILTER_FOR': {
      const adHocFilter: AdHocVariableFilter = {
        key: filter.options.key,
        value: filter.options.value,
        operator: '=',
      };
      // This gives the user the ability to toggle a filter on and off.
      expression = PPLQueryHasFilter(expression, adHocFilter)
        ? removeFilterFromPPLQuery(expression, adHocFilter)
        : addAdhocFilterToPPLQuery(expression, adHocFilter);
      break;
    }
    case 'FILTER_OUT': {
      const adHocFilter: AdHocVariableFilter = {
        key: filter.options.key,
        value: filter.options.value,
        operator: '!=',
      };
      // If the opposite filter is present, remove it before adding the new one.
      const oppositeFilter: AdHocVariableFilter = {
        ...adHocFilter,
        operator: '=',
      };
      if (PPLQueryHasFilter(expression, oppositeFilter)) {
        expression = removeFilterFromPPLQuery(expression, oppositeFilter);
      }
      expression = addAdhocFilterToPPLQuery(expression, adHocFilter);
      break;
    }
  }
  return expression;
}
