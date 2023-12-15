import React from 'react';
import { PPLFormatEditor } from './';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenSearchQuery, QueryType } from 'types';
import { OpenSearchDatasource } from 'datasource';
import { OpenSearchProvider } from '../OpenSearchQueryContext';

const pplLogsQuery: OpenSearchQuery = {
  refId: 'A',
  queryType: QueryType.PPL,
  format: 'table',
  query: 'source = test-index',
};

const setup = () => {
  render(
    <OpenSearchProvider query={pplLogsQuery} datasource={{} as OpenSearchDatasource} onChange={jest.fn()}>
      <PPLFormatEditor />
    </OpenSearchProvider>
  );
};
describe('PPLFormatEditor', () => {
  it('should render correctly', () => {
    setup();
  });

  it('should render all components of PPL format editor row', () => {
    setup();
    waitFor(()  => {
      expect(screen.getByText('Format')).toBeInTheDocument();
      expect(screen.getByText('Time series')).toBeInTheDocument();
      expect(screen.getByTestId('open-close-button')).toBeInTheDocument();
      expect(screen.getByTestId('help-message')).not.toBeInTheDocument();
    })
  
  });
  it('should show help message on click', () => {
    setup();
    waitFor(()  => {
      const button = screen.getByTestId('open-close-button');
      userEvent.click(button);
      waitFor(() => {
        expect(screen.getByTestId('help-message')).toBeInTheDocument();
      });
    })
  });
});
