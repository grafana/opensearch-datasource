import { CustomVariableSupport, DataQuery, DataQueryRequest, DataQueryResponse, VariableSupportType } from '@grafana/data';
import { Observable, from } from 'rxjs';
import type { OpenSearchDatasource } from './opensearchDatasource';
import { OpenSearchOptions, OpenSearchQuery, QueryType } from './types';
import { VariableQueryEditor } from './components/VariableQueryEditor';

/**
 * The query of a variable is the SQL that produces its values. It is written as
 * a string so that a variable created before the editor existed keeps working.
 */
export interface SQLVariableQuery extends DataQuery {
  query: string;
}

/**
 * Finds the SQL of a variable in the target Grafana passes to the variable
 * support.
 *
 * The query of a variable saved before the editor existed is a plain string. The
 * editor writes an object, which Grafana either spreads into the target or nests
 * under `query`, so both shapes are searched for. An object without a string
 * query has no SQL in it.
 *
 * A Lucene or PPL variable is a JSON query, which the datasource handles on its
 * own path. It is not SQL, so it is reported as having no SQL rather than being
 * sent to the SQL endpoint.
 */
export const extractSQLQuery = (target: unknown, depth = 0): string => {
  if (depth > 4 || target === null || target === undefined) {
    return '';
  }

  // Grafana hands a variable target that was saved as a string over as-is.
  if (typeof target === 'string') {
    return isJSONQuery(target) ? '' : target;
  }

  if (typeof target !== 'object') {
    return '';
  }

  const record = target as Record<string, unknown>;
  if (typeof record.query === 'string') {
    return isJSONQuery(record.query) ? '' : record.query;
  }

  // Only the query is searched, because the other properties of a target, such
  // as its refId, are not SQL.
  return extractSQLQuery(record.query, depth + 1);
};

/**
 * Reports whether the query of a variable is the JSON query a Lucene or PPL
 * variable uses. A SQL query starts with a keyword, so a leading brace is the
 * distinguishing mark.
 */
const isJSONQuery = (query: string): boolean => query.trimStart().startsWith('{');

/**
 * Finds the query string a variable holds, whether it is the SQL of a SQL
 * variable or the JSON query of a Lucene or PPL one.
 *
 * Grafana hands a target saved as a string over as-is and nests the query of an
 * untouched target under `query`, so both shapes are read.
 */
export const extractQueryString = (target: unknown, depth = 0): string => {
  if (depth > 4 || target === null || target === undefined) {
    return '';
  }

  if (typeof target === 'string') {
    return target;
  }

  if (typeof target !== 'object') {
    return '';
  }

  const record = target as Record<string, unknown>;
  if (typeof record.query === 'string') {
    return record.query;
  }

  return extractQueryString(record.query, depth + 1);
};

export class OpenSearchVariableSupport extends CustomVariableSupport<
  OpenSearchDatasource,
  SQLVariableQuery,
  OpenSearchQuery,
  OpenSearchOptions
> {
  constructor(private readonly datasource: OpenSearchDatasource) {
    super();
    this.editor = VariableQueryEditor;
  }

  editor: any;

  getType(): VariableSupportType {
    return VariableSupportType.Custom;
  }

  query(request: DataQueryRequest<SQLVariableQuery>): Observable<DataQueryResponse> {
    const target = request.targets?.[0];
    const sql = extractSQLQuery(target);

    return from(
      (async () => {
        // A Lucene or PPL variable is a JSON query, so it goes down the path the
        // datasource had before the editor existed, which reads a query string.
        const query = sql === '' ? extractQueryString(target) : { queryType: QueryType.SQL, query: sql };
        const values = await this.datasource.metricFindQuery(query, { range: request.range });
        return { data: values };
      })()
    );
  }
}
