import React from 'react';
import { mount } from 'enzyme';
import { OpenSearchDetails } from './OpenSearchDetails';
import { createDefaultConfigOptions } from './mocks';
import { LegacyForms } from '@grafana/ui';
import { Flavor, OpenSearchOptions } from 'types';
import { last } from 'lodash';
import { DataSourceSettings } from '@grafana/data';
const { Select, Switch } = LegacyForms;

describe('OpenSearchDetails', () => {
  it('should render without error', () => {
    mount(<OpenSearchDetails onChange={() => {}} value={createDefaultConfigOptions()} />);
  });

  it('should change database on interval change when not set explicitly', () => {
    const onChangeMock = jest.fn();
    const wrapper = mount(<OpenSearchDetails onChange={onChangeMock} value={createDefaultConfigOptions()} />);
    const selectEl = wrapper.find({ label: 'Pattern' }).find(Select);
    selectEl.props().onChange({ value: 'Daily', label: 'Daily' }, { action: 'select-option', option: undefined });

    expect(onChangeMock.mock.calls[0][0].jsonData.interval).toBe('Daily');
    expect(onChangeMock.mock.calls[0][0].database).toBe('[logstash-]YYYY.MM.DD');
  });

  it('should change database on interval change if pattern is from example', () => {
    const onChangeMock = jest.fn();
    const options = createDefaultConfigOptions();
    options.database = '[logstash-]YYYY.MM.DD.HH';
    const wrapper = mount(<OpenSearchDetails onChange={onChangeMock} value={options} />);

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
      const wrapper = mount(<OpenSearchDetails onChange={onChangeMock} value={options} />);

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
      const options = createDefaultConfigOptions();
      options.jsonData.serverless = false;
      const wrapper = mount(<OpenSearchDetails onChange={onChangeMock} value={options} />);

      const switchEl = wrapper.find({ label: 'Serverless' }).find(Switch);
      const event = {
        currentTarget: { checked: true },
      } as React.ChangeEvent<HTMLInputElement>;
      switchEl.props().onChange(event);

      expect(onChangeMock.mock.calls[0][0].jsonData.serverless).toBe(true);
    });

    it('should disable pplEnabled', async () => {
      const onChangeMock = jest.fn();
      const options = createDefaultConfigOptions();
      options.jsonData.serverless = false;
      const wrapper = mount(<OpenSearchDetails onChange={onChangeMock} value={options} />);

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
      it(`sets maxConcurrentShardRequests = ${expected} if version = ${tc.version} & flavor = ${tc.flavor},`, () => {
        const options: DataSourceSettings<OpenSearchOptions> = {
          ...defaultConfig,
          jsonData: {
            ...defaultConfig.jsonData,
            flavor: tc.flavor,
            version: tc.version,
          },
        };
        const wrapper = mount(<OpenSearchDetails onChange={onChangeMock} value={options} />);

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
});
