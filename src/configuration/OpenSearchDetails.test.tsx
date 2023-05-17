import React from 'react';
import { mount } from 'enzyme';
import { OpenSearchDetails } from './OpenSearchDetails';
import { createDefaultConfigOptions } from '__mocks__/DefaultConfigOptions';
import { LegacyForms } from '@grafana/ui';
import { Flavor } from 'types';
import { last } from 'lodash';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupMockedDataSource } from '__mocks__/OpenSearchDatasource';
const { Select, Switch } = LegacyForms;

describe('OpenSearchDetails', () => {
  it('should render without error', () => {
    mount(
      <OpenSearchDetails
        onChange={() => {}}
        value={createDefaultConfigOptions()}
        saveOptions={jest.fn()}
        datasource={null}
      />
    );
  });

  it('should change database on interval change when not set explicitly', () => {
    const onChangeMock = jest.fn();
    const wrapper = mount(
      <OpenSearchDetails
        onChange={onChangeMock}
        value={createDefaultConfigOptions()}
        saveOptions={jest.fn()}
        datasource={null}
      />
    );
    const selectEl = wrapper.find({ label: 'Pattern' }).find(Select);
    selectEl.props().onChange({ value: 'Daily', label: 'Daily' }, { action: 'select-option', option: undefined });

    expect(onChangeMock.mock.calls[0][0].jsonData.interval).toBe('Daily');
    expect(onChangeMock.mock.calls[0][0].database).toBe('[logstash-]YYYY.MM.DD');
  });

  it('should change database on interval change if pattern is from example', () => {
    const onChangeMock = jest.fn();
    const options = createDefaultConfigOptions();
    options.database = '[logstash-]YYYY.MM.DD.HH';
    const wrapper = mount(
      <OpenSearchDetails onChange={onChangeMock} value={options} saveOptions={jest.fn()} datasource={null} />
    );

    const selectEl = wrapper.find({ label: 'Pattern' }).find(Select);
    selectEl.props().onChange({ value: 'Monthly', label: 'Monthly' }, { action: 'select-option', option: undefined });

    expect(onChangeMock.mock.calls[0][0].jsonData.interval).toBe('Monthly');
    expect(onChangeMock.mock.calls[0][0].database).toBe('[logstash-]YYYY.MM');
  });

  describe('PPL enabled setting', () => {
    it('should set pplEnabled', () => {
      const onChangeMock = jest.fn();
      const options = createDefaultConfigOptions();
      options.jsonData.pplEnabled = false;
      const wrapper = mount(
        <OpenSearchDetails onChange={onChangeMock} value={options} saveOptions={jest.fn()} datasource={null} />
      );

      const switchEl = wrapper.find({ label: 'PPL enabled' }).find(Switch);
      const event = {
        currentTarget: { checked: true },
      } as React.ChangeEvent<HTMLInputElement>;
      switchEl.props().onChange(event);

      expect(onChangeMock.mock.calls[0][0].jsonData.pplEnabled).toBe(true);
    });
  });

  describe('Serverless enabled setting', () => {
    it('should set serverless', () => {
      const onChangeMock = jest.fn();
      const options = createDefaultConfigOptions({ flavor: null, version: null });
      options.jsonData.serverless = false;
      const wrapper = mount(
        <OpenSearchDetails onChange={onChangeMock} value={options} saveOptions={jest.fn()} datasource={null} />
      );

      const switchEl = wrapper.find({ label: 'Serverless' }).find(Switch);
      const event = {
        currentTarget: { checked: true },
      } as React.ChangeEvent<HTMLInputElement>;
      switchEl.props().onChange(event);

      expect(onChangeMock.mock.calls[0][0].jsonData.serverless).toBe(true);
      expect(onChangeMock.mock.calls[0][0].jsonData.flavor).toBe(Flavor.OpenSearch);
      expect(onChangeMock.mock.calls[0][0].jsonData.version).toBe('1.0.0');
    });

    it('should disable pplEnabled', async () => {
      const onChangeMock = jest.fn();
      const options = createDefaultConfigOptions();
      options.jsonData.serverless = false;
      const wrapper = mount(
        <OpenSearchDetails onChange={onChangeMock} value={options} saveOptions={jest.fn()} datasource={null} />
      );

      const switchEl = wrapper.find({ label: 'Serverless' }).find(Switch);
      const event = {
        currentTarget: { checked: true },
      } as React.ChangeEvent<HTMLInputElement>;
      switchEl.props().onChange(event);

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
    testCases.forEach(tc => {
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

        await waitFor(() => userEvent.click(screen.getByRole('button', { name: 'Get Version and Save' })));
        expect(onChangeMock).toBeCalled();

        expect(last(onChangeMock.mock.calls)[0].jsonData.maxConcurrentShardRequests).toBe(expected);
      });
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
        .mockResolvedValueOnce({ flavor: Flavor.OpenSearch, version: '2.6.0' });
      const { rerender } = render(
        <OpenSearchDetails
          onChange={jest.fn()}
          value={createDefaultConfigOptions()}
          saveOptions={saveOptionsMock}
          datasource={mockDatasource}
        />
      );

      await waitFor(() => userEvent.click(screen.getByRole('button', { name: 'Get Version and Save' })));
      expect(saveOptionsMock).toBeCalledTimes(1);
      expect(mockDatasource.getOpenSearchVersion).toBeCalled();
      expect(screen.queryByText('test err')).toBeInTheDocument();

      saveOptionsMock.mockClear();
      await waitFor(() => userEvent.click(screen.getByRole('button', { name: 'Get Version and Save' })));
      expect(saveOptionsMock).toBeCalledTimes(2);
      expect(mockDatasource.getOpenSearchVersion).toBeCalled();
      // check onChange results
      expect(last(saveOptionsMock.mock.calls)[0].jsonData.flavor).toBe(Flavor.OpenSearch);
      expect(last(saveOptionsMock.mock.calls)[0].jsonData.version).toBe('2.6.0');

      // rerender with the changed value
      rerender(
        <OpenSearchDetails
          onChange={jest.fn()}
          value={createDefaultConfigOptions({ flavor: Flavor.OpenSearch, version: '2.6.0' })}
          saveOptions={saveOptionsMock}
          datasource={mockDatasource}
        />
      );
      // check that the version is displayed and the error is not
      expect(screen.getByDisplayValue('OpenSearch 2.6.0')).toBeInTheDocument();
      expect(screen.queryByText('test err')).not.toBeInTheDocument();
    });
  });
});
