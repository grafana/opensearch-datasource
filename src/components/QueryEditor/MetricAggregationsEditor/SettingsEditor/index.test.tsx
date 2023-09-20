import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsEditor } from '.';
import { OpenSearchProvider } from '../../OpenSearchQueryContext';
import { OpenSearchQuery } from '../../../../types';
import { setupMockedDataSource } from '__mocks__/OpenSearchDatasource';
import { OpenSearchDatasource } from 'datasource';

describe('Settings Editor', () => {
  describe('Raw Data', () => {
    it('should render with an editable size field', async () => {
      const start = performance.now();
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

      const button = screen.getByRole('button', {
        name: /Size: \d+, Order: \w+$/i,
        hidden: false,
      });

      // The metric row should have a settings button
      expect(button).toBeInTheDocument();

      // open the settings field
      await userEvent.click(button);

      // type in a new value
      await userEvent.type(screen.getByTestId('ES-query-A_metric-1-size'), '{backspace}6{tab}');

      // blur to trigger the onchange event
      // await userEvent.tab();

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toMatchObject({
        bucketAggs: [],
        metrics: [{ id: '1', settings: { order: 'desc', size: '6', useTimeRange: true }, type: 'raw_data' }],
        query: '',
        refId: 'A',
        timeField: '',
      });
      const end = performance.now();
      console.log('First new test Test Took', (end - start).toFixed(4), 'milliseconds to run');
    });

    it('should render with an editable size field', async () => {
      const start = performance.now();
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
      const button = screen.getByTestId('testing-efficiency-of-testids');
      // The metric row should have a settings button
      expect(button).toBeInTheDocument();

      // open the settings field
      await userEvent.click(button);

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
      const end = performance.now();
      console.log('Second New Test Took', (end - start).toFixed(4), 'milliseconds to run');
    });
  });

  describe('old test', () => {
    it('Should correctly render the settings editor and trigger correct state changes', async () => {
      const start = performance.now();
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
      const end = performance.now();
      console.log('Old Test Took', (end - start).toFixed(4), 'milliseconds to run');
    });
  });

  it('which is faster', async () => {
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

    //theoretically the slowest so you'd think maybe running it first would help
    await userEvent.click(
      screen.getByRole('button', {
        name: /Size: \d+, Order: \w+$/i,
        hidden: true,
      })
    );

    let start, end;

    start = performance.now();
    screen.getByText('Size: 5, Order: desc');
    end = performance.now();
    console.log('get by text', (end - start).toFixed(4), 'milliseconds to run');

    start = performance.now();
    screen.getByTestId('testing-efficiency-of-testids');
    end = performance.now();
    console.log('get by test id', (end - start).toFixed(4), 'milliseconds to run');

    start = performance.now();
    screen.getByRole('button', {
      name: /Size: \d+, Order: \w+$/i,
      hidden: true,
    });
    end = performance.now();
    console.log('get by role hidden true', (end - start).toFixed(4), 'milliseconds to run');

    start = performance.now();
    screen.getByRole('button', {
      name: /Size: \d+, Order: \w+$/i,
      hidden: false,
    });
    end = performance.now();
    console.log('get by role hidden false', (end - start).toFixed(4), 'milliseconds to run');
  });
});
