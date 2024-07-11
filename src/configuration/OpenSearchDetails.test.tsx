import React from 'react';
import { OpenSearchDetails } from './OpenSearchDetails';
import { createDefaultConfigOptions } from '__mocks__/DefaultConfigOptions';
import { Flavor } from 'types';
import { last } from 'lodash';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupMockedDataSource } from '__mocks__/OpenSearchDatasource';
import selectEvent from 'react-select-event';

describe('OpenSearchDetails', () => {
  it('should render without error', () => {
    render(
      <OpenSearchDetails
        onChange={() => {}}
        value={createDefaultConfigOptions()}
        saveOptions={jest.fn()}
        datasource={undefined}
      />
    );
  });

  it('should change database on interval change when not set explicitly', async () => {
    const onChangeMock = jest.fn();
    const wrapper = render(
      <OpenSearchDetails
        onChange={onChangeMock}
        value={createDefaultConfigOptions()}
        saveOptions={jest.fn()}
        datasource={undefined}
      />
    );
    const selectEl = wrapper.getByLabelText('Pattern');
    await selectEvent.select(selectEl, 'Daily', { container: document.body });

    expect(onChangeMock.mock.calls[0][0].jsonData.interval).toBe('Daily');
    expect(onChangeMock.mock.calls[0][0].database).toBe('[logstash-]YYYY.MM.DD');
  });

  it('should change database on interval change if pattern is from example', async () => {
    const onChangeMock = jest.fn();
    const options = createDefaultConfigOptions();
    options.database = '[logstash-]YYYY.MM.DD.HH';
    const wrapper = render(
      <OpenSearchDetails onChange={onChangeMock} value={options} saveOptions={jest.fn()} datasource={undefined} />
    );

    const selectEl = wrapper.getByLabelText('Pattern');
    await selectEvent.select(selectEl, 'Monthly');

    expect(onChangeMock.mock.calls[0][0].jsonData.interval).toBe('Monthly');
    expect(onChangeMock.mock.calls[0][0].database).toBe('[logstash-]YYYY.MM');
  });

  describe('PPL enabled setting', () => {
    it('should set pplEnabled', async () => {
      const onChangeMock = jest.fn();
      const options = createDefaultConfigOptions();
      options.jsonData.pplEnabled = false;
      const wrapper = render(
        <OpenSearchDetails onChange={onChangeMock} value={options} saveOptions={jest.fn()} datasource={undefined} />
      );

      const switchEl = wrapper.getByLabelText('PPL enabled');
      await userEvent.click(switchEl);

      expect(onChangeMock.mock.calls[0][0].jsonData.pplEnabled).toBe(true);
    });
  });

  describe('Serverless enabled setting', () => {
    it('should set serverless', async () => {
      const onChangeMock = jest.fn();
      const options = createDefaultConfigOptions({ flavor: undefined, version: undefined });
      options.jsonData.serverless = false;
      const wrapper = render(
        <OpenSearchDetails onChange={onChangeMock} value={options} saveOptions={jest.fn()} datasource={undefined} />
      );
      const switchEl = wrapper.getByLabelText('Serverless');
      await userEvent.click(switchEl);

      expect(onChangeMock.mock.calls[0][0].jsonData.serverless).toBe(true);
      expect(onChangeMock.mock.calls[0][0].jsonData.flavor).toBe(Flavor.OpenSearch);
      expect(onChangeMock.mock.calls[0][0].jsonData.version).toBe('1.0.0');
    });

    it('should disable pplEnabled', async () => {
      const onChangeMock = jest.fn();
      const options = createDefaultConfigOptions();
      options.jsonData.serverless = false;
      const wrapper = render(
        <OpenSearchDetails onChange={onChangeMock} value={options} saveOptions={jest.fn()} datasource={undefined} />
      );
      const switchEl = wrapper.getByLabelText('Serverless');
      await userEvent.click(switchEl);

      expect(onChangeMock.mock.calls[0][0].jsonData.pplEnabled).toBe(false);
    });
  });

  describe('version change', () => {
    const testCases = [
      { version: '5.0.0', flavor: Flavor.Elasticsearch, expectedMaxConcurrentShardRequests: 256 },
      {
        version: '5.0.0',
        flavor: Flavor.Elasticsearch,
        maxConcurrentShardRequests: 50,
        expectedMaxConcurrentShardRequests: 50,
      },
      { version: '5.6.0', flavor: Flavor.Elasticsearch, expectedMaxConcurrentShardRequests: 256 },
      {
        version: '5.6.0',
        flavor: Flavor.Elasticsearch,
        maxConcurrentShardRequests: 256,
        expectedMaxConcurrentShardRequests: 256,
      },
      {
        version: '5.6.0',
        flavor: Flavor.Elasticsearch,
        maxConcurrentShardRequests: 5,
        expectedMaxConcurrentShardRequests: 256,
      },
      {
        version: '5.6.0',
        flavor: Flavor.Elasticsearch,
        maxConcurrentShardRequests: 200,
        expectedMaxConcurrentShardRequests: 200,
      },
      { version: '7.0.0', flavor: Flavor.Elasticsearch, expectedMaxConcurrentShardRequests: 5 },
      {
        version: '7.0.0',
        flavor: Flavor.Elasticsearch,
        maxConcurrentShardRequests: 256,
        expectedMaxConcurrentShardRequests: 5,
      },
      {
        version: '7.0.0',
        flavor: Flavor.Elasticsearch,
        maxConcurrentShardRequests: 5,
        expectedMaxConcurrentShardRequests: 5,
      },
      {
        version: '7.0.0',
        flavor: Flavor.Elasticsearch,
        maxConcurrentShardRequests: 6,
        expectedMaxConcurrentShardRequests: 6,
      },
      {
        version: '1.0.0',
        flavor: Flavor.OpenSearch,
        maxConcurrentShardRequests: 256,
        expectedMaxConcurrentShardRequests: 5,
      },
    ];

    const onChangeMock = jest.fn();

    const defaultConfig = createDefaultConfigOptions();
    testCases.forEach((tc) => {
      const expected = tc.expectedMaxConcurrentShardRequests;
      it(`sets maxConcurrentShardRequests = ${expected} if version = ${tc.version} & flavor = ${tc.flavor},`, async () => {
        const mockDatasource = setupMockedDataSource();
        mockDatasource.getOpenSearchVersion = jest.fn().mockResolvedValue({ flavor: tc.flavor, version: tc.version });
        defaultConfig.jsonData.maxConcurrentShardRequests = tc.maxConcurrentShardRequests;
        render(
          <OpenSearchDetails
            onChange={jest.fn()}
            value={defaultConfig}
            saveOptions={onChangeMock}
            datasource={mockDatasource}
          />
        );
        await userEvent.click(screen.getByRole('button', { name: 'Get Version and Save' }));

        expect(onChangeMock).toHaveBeenCalled();

        expect(last(onChangeMock.mock.calls)[0].jsonData.maxConcurrentShardRequests).toBe(expected);
      });
    });
  });

  describe('version field', () => {
    it('displays the passed label', () => {
      const defaultConfig = createDefaultConfigOptions();
      defaultConfig.jsonData.versionLabel = 'OpenSearch (compatibility mode)';
      render(
        <OpenSearchDetails onChange={jest.fn()} value={defaultConfig} saveOptions={jest.fn()} datasource={undefined} />
      );

      expect(screen.getByDisplayValue('OpenSearch (compatibility mode)')).toBeInTheDocument();
    });

    it('generates the label when one is not passed', () => {
      const defaultConfig = createDefaultConfigOptions();
      render(
        <OpenSearchDetails onChange={jest.fn()} value={defaultConfig} saveOptions={jest.fn()} datasource={undefined} />
      );

      expect(screen.getByDisplayValue('OpenSearch 1.0.0')).toBeInTheDocument();
    });
  });

  describe('opensearchDetectVersion', () => {
    it('displays the error and removes it when getOpenSearchVersion succeeds', async () => {
      // check that it's initialized as null
      const saveOptionsMock = jest.fn();
      const mockDatasource = setupMockedDataSource();
      mockDatasource.getOpenSearchVersion = jest
        .fn()
        .mockRejectedValueOnce(new Error('test err'))
        .mockResolvedValueOnce({ flavor: Flavor.OpenSearch, version: '2.6.0', label: 'OpenSearch 2.6.0' });
      const { rerender } = render(
        <OpenSearchDetails
          onChange={jest.fn()}
          value={createDefaultConfigOptions()}
          saveOptions={saveOptionsMock}
          datasource={mockDatasource}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Get Version and Save' }));
      expect(saveOptionsMock).toHaveBeenCalledTimes(1);
      expect(mockDatasource.getOpenSearchVersion).toHaveBeenCalled();
      expect(screen.queryByText('test err')).toBeInTheDocument();

      saveOptionsMock.mockClear();
      await userEvent.click(screen.getByRole('button', { name: 'Get Version and Save' }));
      expect(saveOptionsMock).toHaveBeenCalledTimes(2);
      expect(mockDatasource.getOpenSearchVersion).toHaveBeenCalled();
      // check onChange results
      expect(last(saveOptionsMock.mock.calls)[0].jsonData.flavor).toBe(Flavor.OpenSearch);
      expect(last(saveOptionsMock.mock.calls)[0].jsonData.version).toBe('2.6.0');

      // rerender with the changed value
      rerender(
        <OpenSearchDetails
          onChange={jest.fn()}
          value={createDefaultConfigOptions({
            flavor: Flavor.OpenSearch,
            version: '2.6.0',
            versionLabel: 'OpenSearch 2.6.0',
          })}
          saveOptions={saveOptionsMock}
          datasource={mockDatasource}
        />
      );
      // check that the version is displayed and the error is not
      expect(screen.getByDisplayValue('OpenSearch 2.6.0')).toBeInTheDocument();
      expect(screen.queryByText('test err')).not.toBeInTheDocument();
    });

    it('displays the error and removes it when serverless is toggled', async () => {
      // check that it's initialized as null
      const onChangeMock = jest.fn();
      const saveOptionsMock = jest.fn();
      const mockDatasource = setupMockedDataSource();
      mockDatasource.getOpenSearchVersion = jest.fn().mockRejectedValueOnce(new Error('test err'));
      const wrapper = render(
        <OpenSearchDetails
          onChange={onChangeMock}
          value={createDefaultConfigOptions()}
          saveOptions={saveOptionsMock}
          datasource={mockDatasource}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Get Version and Save' }));
      expect(saveOptionsMock).toHaveBeenCalledTimes(1);
      expect(mockDatasource.getOpenSearchVersion).toHaveBeenCalled();
      expect(screen.queryByText('test err')).toBeInTheDocument();

      const switchEl = wrapper.getByLabelText('Serverless');
      await userEvent.click(switchEl);
      expect(onChangeMock.mock.calls[0][0].jsonData.serverless).toBe(true);
      expect(onChangeMock.mock.calls[0][0].jsonData.flavor).toBe(Flavor.OpenSearch);
      expect(onChangeMock.mock.calls[0][0].jsonData.version).toBe('1.0.0');

      // rerender with the changed value
      wrapper.rerender(
        <OpenSearchDetails
          onChange={jest.fn()}
          value={createDefaultConfigOptions({ flavor: Flavor.OpenSearch, version: '1.0.0', serverless: true })}
          saveOptions={saveOptionsMock}
          datasource={mockDatasource}
        />
      );
      // check that the error is not displayed
      expect(screen.queryByText('test err')).not.toBeInTheDocument();
    });
  });
});
