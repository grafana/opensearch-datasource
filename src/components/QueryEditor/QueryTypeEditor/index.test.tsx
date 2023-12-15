import React from 'react';
import { QueryTypeEditor } from './';
import { QueryType } from '../../../types';
import { CHANGE_QUERY_TYPE, ChangeQueryTypeAction } from './state';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('should dispatch action on change event', () => {
    const expectedAction: ChangeQueryTypeAction = {
      type: CHANGE_QUERY_TYPE,
      payload: { queryType: QueryType.Lucene },
    };
    render(<QueryTypeEditor value={QueryType.PPL} />);
    userEvent.click(screen.getByText('PPL'));
    waitFor(() => {
      fireEvent.change(screen.getByTestId('query-type'), { target: { value: QueryType.Lucene } });
      expect(mockDispatch).toHaveBeenCalledWith(expectedAction);
    });
  });
});
