import { Action } from '../../../hooks/useStatelessReducer';
import { ElasticsearchQueryType } from '../../../types';
import { INIT, InitAction } from '../state';

export const CHANGE_QUERY_TYPE = 'change_query_type';

export interface ChangeQueryTypeAction extends Action<typeof CHANGE_QUERY_TYPE> {
  payload: {
    queryType: ElasticsearchQueryType;
  };
}

export const changeQueryType = (queryType: ElasticsearchQueryType): ChangeQueryTypeAction => ({
  type: CHANGE_QUERY_TYPE,
  payload: {
    queryType,
  },
});

export const queryTypeReducer = (prevQueryType: ElasticsearchQueryType, action: ChangeQueryTypeAction | InitAction) => {
  switch (action.type) {
    case CHANGE_QUERY_TYPE:
      return action.payload.queryType;

    case INIT:
      return ElasticsearchQueryType.Lucene;

    default:
      return prevQueryType;
  }
};
