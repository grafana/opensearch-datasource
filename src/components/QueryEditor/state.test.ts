import { reducerTester } from '../../dependencies/reducerTester';
import { OpenSearchQuery } from '../../types';
import { aliasPatternReducer, changeAliasPattern, changeQuery, initQuery, queryReducer } from './state';

describe('Query Reducer', () => {
  describe('On Init', () => {
    it('Should maintain the previous `query` if present', () => {
      const initialQuery: OpenSearchQuery['query'] = 'Some lucene query';

      reducerTester<OpenSearchQuery['query']>()
        .givenReducer(queryReducer, initialQuery)
        .whenActionIsDispatched(initQuery())
        .thenStateShouldEqual(initialQuery);
    });

    it('Should set an empty `query` if it is not already set', () => {
      const initialQuery: OpenSearchQuery['query'] = undefined;
      const expectedQuery = '';

      reducerTester<OpenSearchQuery['query']>()
        .givenReducer(queryReducer, initialQuery)
        .whenActionIsDispatched(initQuery())
        .thenStateShouldEqual(expectedQuery);
    });
  });
  it('Should correctly set `query`', () => {
    const expectedQuery: OpenSearchQuery['query'] = 'Some lucene query';

    reducerTester<OpenSearchQuery['query']>()
      .givenReducer(queryReducer, '')
      .whenActionIsDispatched(changeQuery(expectedQuery))
      .thenStateShouldEqual(expectedQuery);
  });

  it('Should not change state with other action types', () => {
    const initialState: OpenSearchQuery['query'] = 'Some lucene query';

    reducerTester<OpenSearchQuery['query']>()
      .givenReducer(queryReducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});

describe('Alias Pattern Reducer', () => {
  it('Should correctly set `alias`', () => {
    const expectedAlias: OpenSearchQuery['alias'] = 'Some alias pattern';

    reducerTester<OpenSearchQuery['query']>()
      .givenReducer(aliasPatternReducer, '')
      .whenActionIsDispatched(changeAliasPattern(expectedAlias))
      .thenStateShouldEqual(expectedAlias);
  });

  it('Should not change state with other action types', () => {
    const initialState: OpenSearchQuery['alias'] = 'Some alias pattern';

    reducerTester<OpenSearchQuery['query']>()
      .givenReducer(aliasPatternReducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});
