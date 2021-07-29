import React, { createContext, PropsWithChildren, useContext } from 'react';
import { OpenSearchDatasource } from '../../datasource';
import { combineReducers, useStatelessReducer, DispatchContext } from '../../hooks/useStatelessReducer';
import { OpenSearchQuery } from '../../types';

import { reducer as metricsReducer } from './MetricAggregationsEditor/state/reducer';
import { createReducer as createBucketAggsReducer } from './BucketAggregationsEditor/state/reducer';
import { queryTypeReducer } from './QueryTypeEditor/state';
import { formatReducer } from './PPLFormatEditor/state';
import { aliasPatternReducer, queryReducer, initQuery } from './state';

const DatasourceContext = createContext<OpenSearchDatasource | undefined>(undefined);
const QueryContext = createContext<OpenSearchQuery | undefined>(undefined);

interface Props {
  query: OpenSearchQuery;
  onChange: (query: OpenSearchQuery) => void;
  datasource: OpenSearchDatasource;
}

export const OpenSearchProvider = ({ children, onChange, query, datasource }: PropsWithChildren<Props>) => {
  const reducer = combineReducers({
    query: queryReducer,
    queryType: queryTypeReducer,
    alias: aliasPatternReducer,
    metrics: metricsReducer,
    bucketAggs: createBucketAggsReducer(datasource.timeField),
    format: formatReducer,
  });

  const dispatch = useStatelessReducer(
    // timeField is part of the query model, but its value is always set to be the one from datasource settings.
    newState => onChange({ ...query, ...newState, timeField: datasource.timeField }),
    query,
    reducer
  );

  // This initializes the query by dispatching an init action to each reducer.
  // useStatelessReducer will then call `onChange` with the newly generated query
  if (!query.metrics || !query.bucketAggs || query.query === undefined) {
    dispatch(initQuery());

    return null;
  }

  return (
    <DatasourceContext.Provider value={datasource}>
      <QueryContext.Provider value={query}>
        <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
      </QueryContext.Provider>
    </DatasourceContext.Provider>
  );
};

export const useQuery = (): OpenSearchQuery => {
  const query = useContext(QueryContext);

  if (!query) {
    throw new Error('use OpenSearchProvider first.');
  }

  return query;
};

export const useDatasource = () => {
  const datasource = useContext(DatasourceContext);
  if (!datasource) {
    throw new Error('use OpenSearchProvider first.');
  }

  return datasource;
};
