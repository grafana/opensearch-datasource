import React from 'react';
import { mount } from 'enzyme';
import { OpenSearchDetails } from './OpenSearchDetails';
import { createDefaultConfigOptions } from './mocks';
import { LegacyForms } from '@grafana/ui';
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
});
