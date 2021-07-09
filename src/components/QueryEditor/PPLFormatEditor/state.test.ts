import { reducerTester } from '../../../dependencies/reducerTester';
import { ElasticsearchQuery } from '../../../types';
import { changeFormat, formatReducer } from './state';

describe('Query Type Reducer', () => {
  it('Should correctly set `format`', () => {
    const expectedFormat: ElasticsearchQuery['format'] = 'time_series';

    reducerTester()
      .givenReducer(formatReducer, 'table')
      .whenActionIsDispatched(changeFormat(expectedFormat))
      .thenStateShouldEqual(expectedFormat);
  });

  it('Should not change state with other action types', () => {
    const initialState: ElasticsearchQuery['format'] = 'time_series';

    reducerTester()
      .givenReducer(formatReducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});
