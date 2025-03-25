import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { PropsWithChildren } from 'react';

import { OpenSearchQuery } from '../../../types';
import { OpenSearchProvider } from '../OpenSearchQueryContext';

import { MetricEditor } from './MetricEditor';
import { setupMockedDataSource } from '__mocks__/OpenSearchDatasource';
import { MetricAggregation } from './aggregations';

describe('Metric Editor', () => {
  it('Should not list special metrics', async () => {
    const count: MetricAggregation = {
      id: '1',
      type: 'count',
    };

    const mockQuery: OpenSearchQuery = {
      refId: 'A',
      query: '',
      metrics: [count],
      bucketAggs: [],
    };

    const wrapper = ({ children }: PropsWithChildren<{}>) => (
      <OpenSearchProvider query={mockQuery} onChange={jest.fn()} datasource={setupMockedDataSource()}>
        {children}
      </OpenSearchProvider>
    );

    render(<MetricEditor value={count} />, { wrapper });
    await userEvent.click(screen.getByText('Count'));

    // we check if the list-of-options is visible by
    // checking for an item to exist
    expect(screen.getByText('Extended Stats')).toBeInTheDocument();

    // now we make sure that special metric aren't shown
    expect(screen.queryByText('Logs')).toBeNull();
    expect(screen.queryByText('Raw Data')).toBeNull();
    expect(screen.queryByText('Raw Document')).toBeNull();
  });
});
