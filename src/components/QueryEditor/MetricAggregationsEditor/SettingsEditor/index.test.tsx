import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsEditor } from '.';
import { OpenSearchProvider } from '../../OpenSearchQueryContext';
import { OpenSearchDatasource } from '../../../../datasource';
import { OpenSearchQuery } from '../../../../types';

describe('Settings Editor', () => {
  describe('Raw Data', () => {
    it('Should correctly render the settings editor and trigger correct state changes', async () => {
      const metricId = '1';
      const initialSize = '500';
      const initialOrder = 'desc';
      const query: OpenSearchQuery = {
        refId: 'A',
        query: '',
        metrics: [
          {
            id: metricId,
            type: 'raw_data',
            settings: {
              size: initialSize,
              order: 'desc',
              useTimeRange: true,
            },
          },
        ],
        bucketAggs: [],
      };

      const onChange = jest.fn();

      const { rerender } = render(
        <OpenSearchProvider query={query} datasource={{} as OpenSearchDatasource} onChange={onChange}>
          <SettingsEditor metric={query.metrics![0]} previousMetrics={[]} />
        </OpenSearchProvider>
      );

      let settingsButtonEl = screen.getByRole('button', {
        name: /Size: \d+, Order: \w+$/i,
      });

      // The metric row should have a settings button
      expect(settingsButtonEl).toBeInTheDocument();
      expect(settingsButtonEl.textContent).toBe(`Size: ${initialSize}, Order: ${initialOrder}`);

      // Open the settings editor
      fireEvent.click(settingsButtonEl);

      // The settings editor should have a Size input
      const sizeInputEl = screen.getByLabelText('Size');
      expect(sizeInputEl).toBeInTheDocument();

      // We change value and trigger a blur event to trigger an update
      const newSizeValue = '23';
      fireEvent.change(sizeInputEl, { target: { value: newSizeValue } });
      fireEvent.blur(sizeInputEl);

      // the onChange handler should have been called correctly, and the resulting
      // query state should match what expected
      expect(onChange).toHaveBeenCalledTimes(1);
      rerender(
        <OpenSearchProvider
          query={onChange.mock.calls[0][0]}
          datasource={{} as OpenSearchDatasource}
          onChange={onChange}
        >
          <SettingsEditor metric={onChange.mock.calls[0][0].metrics![0]} previousMetrics={[]} />
        </OpenSearchProvider>
      );

      settingsButtonEl = screen.getByRole('button', {
        name: /Size: \d+, Order: \w+$/i,
      });
      expect(settingsButtonEl).toBeInTheDocument();
      expect(settingsButtonEl.textContent).toBe(`Size: ${newSizeValue}, Order: ${initialOrder}`);

      let select = (await screen.findByText('Order')).nextSibling!.firstChild!;
      await fireEvent.keyDown(select, { keyCode: 40 });
      const scs = screen.getAllByLabelText('Select option');
      expect(scs).toHaveLength(2);

      // Define new value and trigger a click to update metric
      const newOrderValue = 'asc';
      await userEvent.click(screen.getByText('Ascending'));
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          metrics: expect.arrayContaining([
            expect.objectContaining({ settings: expect.objectContaining({ order: 'asc' }) }),
          ]),
        })
      );

      rerender(
        <OpenSearchProvider
          query={onChange.mock.calls[1][0]}
          datasource={{} as OpenSearchDatasource}
          onChange={onChange}
        >
          <SettingsEditor metric={onChange.mock.calls[1][0].metrics![0]} previousMetrics={[]} />
        </OpenSearchProvider>
      );

      settingsButtonEl = screen.getByRole('button', {
        name: /Size: \d+, Order: \w+$/i,
      });
      expect(settingsButtonEl).toBeInTheDocument();
      expect(settingsButtonEl.textContent).toBe(`Size: ${newSizeValue}, Order: ${newOrderValue}`);
    });
  });
});
