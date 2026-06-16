import { reducerTester } from '../../../../reducerTester';
import { OpenSearchQuery } from '../../../../types';
import { changeFormat, formatReducer } from './state';

describe('Query Type Reducer', () => {
  it('Should correctly set `format`', () => {
    const expectedFormat: OpenSearchQuery['format'] = 'time_series';

    reducerTester<OpenSearchQuery['format']>()
      .givenReducer(formatReducer, 'table')
      .whenActionIsDispatched(changeFormat(expectedFormat))
      .thenStateShouldEqual(expectedFormat);
  });

  it('Should not change state with other action types', () => {
    const initialState: OpenSearchQuery['format'] = 'time_series';

    reducerTester<OpenSearchQuery['format']>()
      .givenReducer(formatReducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});
