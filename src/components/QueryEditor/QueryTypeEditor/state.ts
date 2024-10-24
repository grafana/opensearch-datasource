import { createAction } from '@reduxjs/toolkit';
import { Action } from '../../../hooks/useStatelessReducer';
import { OpenSearchQuery, QueryType } from '../../../types';
import { initQuery } from '../state';

export const CHANGE_QUERY_TYPE = 'change_query_type';

export const changeQueryType = createAction<OpenSearchQuery['queryType']>(CHANGE_QUERY_TYPE);

export const queryTypeReducer = (prevQueryType: OpenSearchQuery['queryType'], action: Action) => {
  if (changeQueryType.match(action)) {
    return action.payload;
  }
  if (initQuery.match(action)) {
    return QueryType.Lucene;
  }

  return prevQueryType;
};
