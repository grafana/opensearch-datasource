import { reducerTester } from '../../../dependencies/reducerTester';
import { ElasticsearchQuery, ElasticsearchQueryType } from '../../../types';
import { changeQueryType, queryTypeReducer } from './state';

describe('Query Type Reducer', () => {
  it('Should correctly set `queryType`', () => {
    const expectedQueryType: ElasticsearchQuery['queryType'] = ElasticsearchQueryType.PPL;

    reducerTester()
      .givenReducer(queryTypeReducer, ElasticsearchQueryType.Lucene)
      .whenActionIsDispatched(changeQueryType(expectedQueryType))
      .thenStateShouldEqual(expectedQueryType);
  });

  it('Should not change state with other action types', () => {
    const initialState: ElasticsearchQuery['queryType'] = ElasticsearchQueryType.Lucene;

    reducerTester()
      .givenReducer(queryTypeReducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});
