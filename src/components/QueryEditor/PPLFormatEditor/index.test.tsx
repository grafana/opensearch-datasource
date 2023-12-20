import React from 'react';
import { PPLFormatEditor } from './';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenSearchQuery, QueryType } from 'types';
import { OpenSearchDatasource } from 'datasource';
import { OpenSearchProvider } from '../OpenSearchQueryContext';

const pplLogsQuery: OpenSearchQuery = {
  refId: 'A',
  queryType: QueryType.PPL,
  format: 'time_series',
  query: 'source = test-index',
  bucketAggs: [{ type: 'date_histogram', id: '2' }],
  metrics: [{ id: '1', type: 'count' }],
};

const setup = () => {
  render(
    <OpenSearchProvider
      query={pplLogsQuery}
      datasource={{} as OpenSearchDatasource}
      onChange={jest.fn()}
    >
      <PPLFormatEditor />
    </OpenSearchProvider>
  );
};
describe('PPLFormatEditor', () => {
  it('should render correctly', () => {
    setup();
  });
  it('should render all components of PPL format editor row', async () => {
    setup();
      expect(await screen.findByText('Format')).toBeInTheDocument();
      expect(screen.getByText('Time series')).toBeInTheDocument();
      expect(screen.getByText('Show help')).toBeInTheDocument();
      expect(screen.queryByTestId('help-message')).not.toBeInTheDocument();
    });
  it('should show help message on click', async () => {
    setup();
      const button = await screen.findByText('Show help');
      await userEvent.click(button);
      expect(screen.getByTestId('help-message')).toBeInTheDocument();
  });
});
