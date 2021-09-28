import React from 'react';
import { mount } from 'enzyme';
import { OpenSearchDetails } from './OpenSearchDetails';
import { createDefaultConfigOptions } from './mocks';
import { LegacyForms } from '@grafana/ui';
import { Flavor, OpenSearchOptions } from 'types';
import { last } from 'lodash';
import { DataSourceSettings } from '@grafana/data';
import { AVAILABLE_VERSIONS } from './utils';
const { Select, Switch } = LegacyForms;

describe('OpenSearchDetails', () => {
  it('should render without error', () => {
    mount(<OpenSearchDetails onChange={() => {}} value={createDefaultConfigOptions()} />);
  });

  it('should change database on interval change when not set explicitly', () => {
    const onChangeMock = jest.fn();
    const wrapper = mount(<OpenSearchDetails onChange={onChangeMock} value={createDefaultConfigOptions()} />);
    const selectEl = wrapper.find({ label: 'Pattern' }).find(Select);
    selectEl.props().onChange({ value: 'Daily', label: 'Daily' });

    expect(onChangeMock.mock.calls[0][0].jsonData.interval).toBe('Daily');
    expect(onChangeMock.mock.calls[0][0].database).toBe('[logstash-]YYYY.MM.DD');
  });

  it('should change database on interval change if pattern is from example', () => {
    const onChangeMock = jest.fn();
    const options = createDefaultConfigOptions();
    options.database = '[logstash-]YYYY.MM.DD.HH';
    const wrapper = mount(<OpenSearchDetails onChange={onChangeMock} value={options} />);

    const selectEl = wrapper.find({ label: 'Pattern' }).find(Select);
    selectEl.props().onChange({ value: 'Monthly', label: 'Monthly' });

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
        selectEl.props().onChange({ value: tc.version, label: tc.version.toString() });

        expect(last(onChangeMock.mock.calls)[0].jsonData.maxConcurrentShardRequests).toBe(expected);
      });
    });
  });

  describe('flavor change', () => {
    const defaultConfig = createDefaultConfigOptions();

    it.each`
      flavor                  | version    | newFlavor               | expectedVersion
      ${Flavor.OpenSearch}    | ${'1.0.0'} | ${Flavor.Elasticsearch} | ${last(AVAILABLE_VERSIONS.elasticsearch).value}
      ${Flavor.Elasticsearch} | ${'2.0.0'} | ${Flavor.OpenSearch}    | ${last(AVAILABLE_VERSIONS.opensearch).value}
      ${Flavor.Elasticsearch} | ${'7.0.0'} | ${Flavor.OpenSearch}    | ${last(AVAILABLE_VERSIONS.opensearch).value}
    `(
      'Switching from $flavor $version to $newFlavor sets version to $expectedVersion',
      ({ version, flavor, expectedVersion, newFlavor }) => {
        const onChange = jest.fn();
        const config: DataSourceSettings<OpenSearchOptions> = {
          ...defaultConfig,
          jsonData: {
            ...defaultConfig.jsonData,
            version,
            flavor,
          },
        };

        const wrapper = mount(<OpenSearchDetails onChange={onChange} value={config} />);

        const selectEl = wrapper.find({ label: 'Flavor' }).find(Select);
        selectEl.props().onChange({ value: newFlavor, label: newFlavor });

        expect(last(onChange.mock.calls)[0].jsonData.version).toBe(expectedVersion);
        expect(last(onChange.mock.calls)[0].jsonData.flavor).toBe(newFlavor);
      }
    );
  });
});
