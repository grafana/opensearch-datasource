import { createAction } from '@reduxjs/toolkit';
import { OpenSearchQuery } from 'types';
import { Action } from '../../hooks/useStatelessReducer';

export const INIT = 'init';
const CHANGE_QUERY = 'change_query';
const CHANGE_ALIAS_PATTERN = 'change_alias_pattern';

export interface InitAction extends Action<typeof INIT> {}

/**
 * When the `initQuery` Action is dispatched, the query gets populated with default values where values are not present.
 * This means it won't override any existing value in place, but just ensure the query is in a "runnable" state.
 */
export const initQuery = createAction(INIT);

export const changeQuery = createAction<OpenSearchQuery['query']>(CHANGE_QUERY);

export const changeAliasPattern = createAction<OpenSearchQuery['alias']>(CHANGE_ALIAS_PATTERN);

export const queryReducer = (prevQuery: OpenSearchQuery['query'], action: Action) => {
  if (changeQuery.match(action)) {
    return action.payload;
  }
  if (initQuery.match(action)) {
    return prevQuery || '';
  }

  return prevQuery;
};

export const aliasPatternReducer = (prevAliasPattern: OpenSearchQuery['alias'], action: Action) => {
  if (changeAliasPattern.match(action)) {
    return action.payload;
  }
  if (initQuery.match(action)) {
    return prevAliasPattern || '';
  }

  return prevAliasPattern;
};
