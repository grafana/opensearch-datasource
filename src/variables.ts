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
 */
export const extractSQLQuery = (target: unknown, depth = 0): string => {
  if (depth > 4 || target === null || target === undefined) {
    return '';
  }

  // Grafana hands a variable target that was saved as a string over as-is.
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

  // Only the query is searched, because the other properties of a target, such
  // as its refId, are not SQL.
  return extractSQLQuery(record.query, depth + 1);
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
    const sql = extractSQLQuery(request.targets?.[0]);

    return from(
      (async () => {
        const values = await this.datasource.metricFindQuery(
          { queryType: QueryType.SQL, query: sql },
          { range: request.range }
        );
        return { data: values };
      })()
    );
  }
}
