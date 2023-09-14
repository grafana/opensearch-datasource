import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsEditor } from '.';
import { OpenSearchProvider } from '../../OpenSearchQueryContext';
import { OpenSearchQuery } from '../../../../types';
import { setupMockedDataSource } from '__mocks__/OpenSearchDatasource';

describe('Settings Editor', () => {
  describe('Raw Data', () => {
    it('should render with an editable size field', async () => {
      const query: OpenSearchQuery = {
        refId: 'A',
        query: '',
        metrics: [
          {
            id: '1',
            type: 'raw_data',
            settings: {
              size: '5',
              order: 'desc',
              useTimeRange: true,
            },
          },
        ],
        bucketAggs: [],
      };
      const datasource = setupMockedDataSource();

      const onChange = jest.fn();

      render(
        <OpenSearchProvider query={query} datasource={datasource} onChange={onChange}>
          <SettingsEditor metric={query.metrics[0]} previousMetrics={[]} />
        </OpenSearchProvider>
      );

      // The metric row should have a settings button
      expect(screen.getByText('Size: 5, Order: desc')).toBeInTheDocument();

      // open the settings field
      await userEvent.click(screen.getByText('Size: 5, Order: desc'));

      // type in a new value
      await userEvent.type(screen.getByTestId('ES-query-A_metric-1-size'), '{backspace}6');

      // blur to trigger the onchange event
      await userEvent.tab();

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toMatchObject({
        bucketAggs: [],
        metrics: [{ id: '1', settings: { order: 'desc', size: '6', useTimeRange: true }, type: 'raw_data' }],
        query: '',
        refId: 'A',
        timeField: '',
      });
    });

    it('should render with an editable size field', async () => {
      const query: OpenSearchQuery = {
        refId: 'A',
        query: '',
        metrics: [
          {
            id: '1',
            type: 'raw_data',
            settings: {
              size: '5',
              order: 'desc',
              useTimeRange: true,
            },
          },
        ],
        bucketAggs: [],
      };
      const datasource = setupMockedDataSource();

      const onChange = jest.fn();

      render(
        <OpenSearchProvider query={query} datasource={datasource} onChange={onChange}>
          <SettingsEditor metric={query.metrics[0]} previousMetrics={[]} />
        </OpenSearchProvider>
      );

      // The metric row should have a settings button
      expect(screen.getByText('Size: 5, Order: desc')).toBeInTheDocument();

      // open the settings field
      await userEvent.click(screen.getByText('Size: 5, Order: desc'));

      // open the order dropdown and select ascending
      await userEvent.click(screen.getByText('Descending'));
      await userEvent.click(screen.getByText('Ascending'));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toMatchObject({
        bucketAggs: [],
        metrics: [{ id: '1', settings: { order: 'asc', size: '5', useTimeRange: true }, type: 'raw_data' }],
        query: '',
        refId: 'A',
        timeField: '',
      });
    });
  });
});
