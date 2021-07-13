import { reducerTester } from '../../dependencies/reducerTester';
import { OpenSearchQuery } from '../../types';
import { aliasPatternReducer, changeAliasPattern, changeQuery, queryReducer } from './state';

describe('Query Reducer', () => {
  it('Should correctly set `query`', () => {
    const expectedQuery: OpenSearchQuery['query'] = 'Some lucene query';

    reducerTester()
      .givenReducer(queryReducer, '')
      .whenActionIsDispatched(changeQuery(expectedQuery))
      .thenStateShouldEqual(expectedQuery);
  });

  it('Should not change state with other action types', () => {
    const initialState: OpenSearchQuery['query'] = 'Some lucene query';

    reducerTester()
      .givenReducer(queryReducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});

describe('Alias Pattern Reducer', () => {
  it('Should correctly set `alias`', () => {
    const expectedAlias: OpenSearchQuery['alias'] = 'Some alias pattern';

    reducerTester()
      .givenReducer(aliasPatternReducer, '')
      .whenActionIsDispatched(changeAliasPattern(expectedAlias))
      .thenStateShouldEqual(expectedAlias);
  });

  it('Should not change state with other action types', () => {
    const initialState: OpenSearchQuery['alias'] = 'Some alias pattern';

    reducerTester()
      .givenReducer(aliasPatternReducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});
