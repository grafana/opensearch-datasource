import { Action } from '../../../hooks/useStatelessReducer';
import { QueryType } from '../../../types';
import { INIT, InitAction } from '../state';

export const CHANGE_QUERY_TYPE = 'change_query_type';

export interface ChangeQueryTypeAction extends Action<typeof CHANGE_QUERY_TYPE> {
  payload: {
    queryType: QueryType;
  };
}

export const changeQueryType = (queryType: QueryType): ChangeQueryTypeAction => ({
  type: CHANGE_QUERY_TYPE,
  payload: {
    queryType,
  },
});

export const queryTypeReducer = (prevQueryType: QueryType, action: ChangeQueryTypeAction | InitAction) => {
  switch (action.type) {
    case CHANGE_QUERY_TYPE:
      return action.payload.queryType;

    case INIT:
      return QueryType.Lucene;

    default:
      return prevQueryType;
  }
};
