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
