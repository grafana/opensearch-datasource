import React from 'react';
import { QueryTypeEditor } from './';
import { QueryType } from '../../../types';
import { CHANGE_QUERY_TYPE } from './state';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockDatasource = {
  getSupportedQueryTypes: () => [QueryType.Lucene, QueryType.PPL],
};

beforeAll(() => {
  comboboxTestSetup();
});

jest.mock('../OpenSearchQueryContext', () => ({
  useDatasource: jest.fn(() => mockDatasource),
}));

const mockDispatch = jest.fn();

jest.mock('../../../hooks/useStatelessReducer', () => ({
  useDispatch: jest.fn(() => mockDispatch),
}));

describe('QueryTypeEditor', () => {
  it('should render correctly', () => {
    render(<QueryTypeEditor value={QueryType.Lucene} />);
  });

  it('should dispatch action on change event', async () => {
    const expectedAction = {
      type: CHANGE_QUERY_TYPE,
      payload: QueryType.Lucene,
    };
    render(<QueryTypeEditor value={QueryType.PPL} />);

    await userEvent.click(screen.getByTestId('query-type-select'));
    await userEvent.click(screen.getByRole('option', { name: 'Lucene' }));

    expect(mockDispatch).toHaveBeenCalledWith(expectedAction);
  });
});
