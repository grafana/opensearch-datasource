import { reducerTester } from '../../../dependencies/reducerTester';
import { ElasticsearchQuery, QueryType } from '../../../types';
import { changeQueryType, queryTypeReducer } from './state';

describe('Query Type Reducer', () => {
  it('Should correctly set `queryType`', () => {
    const expectedQueryType: ElasticsearchQuery['queryType'] = QueryType.PPL;

    reducerTester()
      .givenReducer(queryTypeReducer, QueryType.Lucene)
      .whenActionIsDispatched(changeQueryType(expectedQueryType))
      .thenStateShouldEqual(expectedQueryType);
  });

  it('Should not change state with other action types', () => {
    const initialState: ElasticsearchQuery['queryType'] = QueryType.Lucene;

    reducerTester()
      .givenReducer(queryTypeReducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});
