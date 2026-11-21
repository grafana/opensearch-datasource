import React from 'react';
import { QueryTypeEditor } from './';
import { QueryType } from '../../../types';
import { CHANGE_QUERY_TYPE } from './state';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockDatasource = {
  getSupportedQueryTypes: () => [QueryType.Lucene, QueryType.PPL],
};

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

  it('should show a query type that is saved but not supported', () => {
    // With SQL disabled, a dashboard saved with a SQL query still holds one. Dropping
    // the option would leave the select without a value, so the user would see an
    // empty query type instead of the one the query is written in.
    render(<QueryTypeEditor value={QueryType.SQL} />);

    expect(screen.getByText('SQL (disabled)')).toBeInTheDocument();
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
