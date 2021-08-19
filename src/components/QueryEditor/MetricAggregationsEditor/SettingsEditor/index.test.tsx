import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsEditor } from '.';
import { OpenSearchProvider } from '../../OpenSearchQueryContext';
import { OpenSearchDatasource } from '../../../../datasource';
import { OpenSearchQuery } from '../../../../types';

describe('Settings Editor', () => {
  describe('Raw Data', () => {
    it('Should correctly render the settings editor and trigger correct state changes', () => {
      const metricId = '1';
      const initialSize = '500';
      const query: OpenSearchQuery = {
        refId: 'A',
        query: '',
        metrics: [
          {
            id: metricId,
            type: 'raw_data',
            settings: {
              size: initialSize,
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
        name: /Size: \d+$/i,
      });

      // The metric row should have a settings button
      expect(settingsButtonEl).toBeInTheDocument();
      expect(settingsButtonEl.textContent).toBe(`Size: ${initialSize}`);

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
        name: /Size: \d+$/i,
      });
      expect(settingsButtonEl).toBeInTheDocument();
      expect(settingsButtonEl.textContent).toBe(`Size: ${newSizeValue}`);
    });
  });
});
