import { reducerTester } from '../../../reducerTester';
import { initQuery } from '../state';
import { OpenSearchQuery, QueryType } from '../../../types';
import { changeQueryType, queryTypeReducer } from './state';

describe('Query Type Reducer', () => {
  it('Should correctly set `queryType`', () => {
    const expectedQueryType: OpenSearchQuery['queryType'] = QueryType.PPL;

    reducerTester<OpenSearchQuery['queryType']>()
      .givenReducer(queryTypeReducer, QueryType.Lucene)
      .whenActionIsDispatched(changeQueryType(expectedQueryType))
      .thenStateShouldEqual(expectedQueryType);
  });

  it('Should not change state with other action types', () => {
    const initialState: OpenSearchQuery['queryType'] = QueryType.Lucene;

    reducerTester<OpenSearchQuery['queryType']>()
      .givenReducer(queryTypeReducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});

describe('Query Type Reducer when the query is initialized', () => {
  it.each([QueryType.Lucene, QueryType.PPL, QueryType.SQL])('Should keep %s', (queryType) => {
    // Initializing fills in the fields a query is missing, such as the metrics and the
    // bucket aggregations a query written as SQL or by hand does not carry. It must not
    // change a query type that was saved, or a SQL query starts running as Lucene.
    reducerTester<OpenSearchQuery['queryType']>()
      .givenReducer(queryTypeReducer, queryType)
      .whenActionIsDispatched(initQuery())
      .thenStateShouldEqual(queryType);
  });

  it('Should fall back to Lucene for a query without a query type', () => {
    reducerTester<OpenSearchQuery['queryType']>()
      .givenReducer(queryTypeReducer, undefined)
      .whenActionIsDispatched(initQuery())
      .thenStateShouldEqual(QueryType.Lucene);
  });
});
