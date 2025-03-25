import { LuceneQueryType, OpenSearchQuery } from 'types';
import { initQuery } from '../state';
import { luceneQueryTypeReducer, updateLuceneTypeAndMetrics } from './state';
import { reducerTester } from 'reducerTester';

describe('Lucene Query Type Reducer', () => {
  describe('On Init', () => {
    it('Should maintain the previous query type if present', () => {
      const initialType: LuceneQueryType = LuceneQueryType.Logs;
      reducerTester<OpenSearchQuery['luceneQueryType']>()
        .givenReducer(luceneQueryTypeReducer, initialType)
        .whenActionIsDispatched(initQuery())
        .thenStateShouldEqual(initialType);
    });

    it('Should set lucene type to Metric if it is not already set', () => {
      const initialType: OpenSearchQuery['luceneQueryType'] = undefined;
      const expectedType = LuceneQueryType.Metric;

      reducerTester<OpenSearchQuery['luceneQueryType']>()
        .givenReducer(luceneQueryTypeReducer, initialType)
        .whenActionIsDispatched(initQuery())
        .thenStateShouldEqual(expectedType);
    });
  });

  it('Should correctly set lucene query type', () => {
    const initialType: LuceneQueryType = LuceneQueryType.Traces;
    reducerTester<OpenSearchQuery['luceneQueryType']>()
      .givenReducer(luceneQueryTypeReducer, initialType)
      .whenActionIsDispatched(
        updateLuceneTypeAndMetrics({ luceneQueryType: LuceneQueryType.Logs, id: '1', type: 'count' })
      )
      .thenStateShouldEqual(LuceneQueryType.Logs);
  });

  it('Should not change state with other action types', () => {
    const initialType: LuceneQueryType = LuceneQueryType.Traces;

    reducerTester<OpenSearchQuery['luceneQueryType']>()
      .givenReducer(luceneQueryTypeReducer, initialType)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialType);
  });
});
