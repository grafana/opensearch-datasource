import { type Action, createAction } from '@reduxjs/toolkit';
import { OpenSearchQuery, QueryType } from '../../../types';
import { initQuery } from '../state';

export const CHANGE_QUERY_TYPE = 'change_query_type';

export const changeQueryType = createAction<OpenSearchQuery['queryType']>(CHANGE_QUERY_TYPE);

const isQueryType = (queryType: unknown): queryType is QueryType => Object.values(QueryType).includes(queryType as QueryType);

export const queryTypeReducer = (prevQueryType: OpenSearchQuery['queryType'], action: Action) => {
  if (changeQueryType.match(action)) {
    return action.payload;
  }
  if (initQuery.match(action)) {
    // Initializing fills in what a query is missing; it does not choose a language.
    // Overwriting the query type here would run a saved SQL or PPL query as Lucene.
    // A value this version does not know is not kept, because the backend would
    // reject it instead of running the query.
    return isQueryType(prevQueryType) ? prevQueryType : QueryType.Lucene;
  }

  return prevQueryType;
};
