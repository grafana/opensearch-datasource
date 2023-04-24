import React from 'react';
import { mount } from 'enzyme';
import { OpenSearchDetails } from './OpenSearchDetails';
import { createDefaultConfigOptions } from '__mocks__/DefaultConfigOptions';
import { LegacyForms } from '@grafana/ui';
import { Flavor, OpenSearchOptions } from 'types';
import { last } from 'lodash';
import { DataSourceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupMockedDataSource } from '__mocks__/openSearchDatasource';
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
    const opensearchDetectVersionValue = config.featureToggles.opensearchDetectVersion;

    afterAll(() => {
      config.featureToggles.opensearchDetectVersion = opensearchDetectVersionValue;
    });
    testCases.forEach(tc => {
      const expected = tc.expectedMaxConcurrentShardRequests;
      it(`sets maxConcurrentShardRequests = ${expected} if version = ${tc.version} & flavor = ${tc.flavor},`, () => {
        config.featureToggles.opensearchDetectVersion = false;
        const options: DataSourceSettings<OpenSearchOptions> = {
          ...defaultConfig,
          jsonData: {
            ...defaultConfig.jsonData,
            flavor: tc.flavor,
            version: tc.version,
          },
        };
        const wrapper = mount(
          <OpenSearchDetails onChange={onChangeMock} value={options} saveOptions={jest.fn()} datasource={null} />
        );

        wrapper.setProps({
          onChange: onChangeMock,
          value: {
            ...options,
            jsonData: {
              ...options.jsonData,
              maxConcurrentShardRequests: tc.maxConcurrentShardRequests,
            },
          },
        });

        const selectEl = wrapper.find({ label: 'Version' }).find(Select);
        selectEl
          .props()
          .onChange(
            { value: { version: tc.version, flavor: tc.flavor }, label: tc.version.toString() },
            { action: 'select-option', option: undefined }
          );

        expect(last(onChangeMock.mock.calls)[0].jsonData.maxConcurrentShardRequests).toBe(expected);
      });
    });
  });

  describe('opensearchDetectVersion', () => {
    const opensearchDetectVersionValue = config.featureToggles.opensearchDetectVersion;

    afterAll(() => {
      config.featureToggles.opensearchDetectVersion = opensearchDetectVersionValue;
    });
    it('displays the error and removes it when getOpenSearchVersion succeeds', async () => {
      config.featureToggles.opensearchDetectVersion = true;
      // check that it's initialized as null
      const saveOptionsMock = jest.fn();
      const onChangeMock = jest.fn();
      const mockDatasource = setupMockedDataSource();
      mockDatasource.getOpenSearchVersion = jest
        .fn()
        .mockRejectedValueOnce(new Error('test err'))
        .mockResolvedValueOnce({ flavor: Flavor.OpenSearch, version: '1.0.1' });
      render(
        <OpenSearchDetails
          onChange={onChangeMock}
          value={createDefaultConfigOptions()}
          saveOptions={saveOptionsMock}
          datasource={mockDatasource}
        />
      );

      // click button
      await act(async () => {
        await userEvent.click(screen.getByText('Save and Get Version'));
      });
      // check that the error is displayed
      expect(saveOptionsMock).toBeCalled();
      expect(mockDatasource.getOpenSearchVersion).toBeCalled();
      expect(onChangeMock).not.toBeCalled();
      expect(screen.queryByText('test err')).toBeInTheDocument();

      await act(async () => {
        await userEvent.click(screen.getByText('Save and Get Version'));
      });
      // check that save and fetch version were called
      expect(saveOptionsMock).toBeCalled();
      expect(mockDatasource.getOpenSearchVersion).toBeCalled();
      // check onChange results
      expect(last(onChangeMock.mock.calls)[0].jsonData.flavor).toBe(Flavor.OpenSearch);
      expect(last(onChangeMock.mock.calls)[0].jsonData.version).toBe('1.0.1');
      // check that the version is displayed and the error is not
      expect(screen.queryByDisplayValue('OpenSearch 1.0.0')).toBeInTheDocument();
      expect(screen.queryByText('test err')).not.toBeInTheDocument();
    });
  });
});
