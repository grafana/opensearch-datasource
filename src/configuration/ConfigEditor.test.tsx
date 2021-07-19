import React from 'react';
import { mount, shallow } from 'enzyme';
import { ConfigEditor } from './ConfigEditor';
import { DataSourceHttpSettings } from '@grafana/ui';
import { OpenSearchDetails } from './OpenSearchDetails';
import { LogsConfig } from './LogsConfig';
import { createDefaultConfigOptions } from './mocks';

describe('ConfigEditor', () => {
  it('should render without error', () => {
    mount(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);
  });

  it('should render all parts of the config', () => {
    const wrapper = shallow(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);
    expect(wrapper.find(DataSourceHttpSettings).length).toBe(1);
    expect(wrapper.find(OpenSearchDetails).length).toBe(1);
    expect(wrapper.find(LogsConfig).length).toBe(1);
  });

  it('should set defaults', () => {
    const options = createDefaultConfigOptions();

    delete options.jsonData.version;
    delete options.jsonData.timeField;
    delete options.jsonData.maxConcurrentShardRequests;
    delete options.jsonData.pplEnabled;

    expect.assertions(4);

    mount(
      <ConfigEditor
        onOptionsChange={options => {
          expect(options.jsonData.version).toBe('1.0.0');
          expect(options.jsonData.timeField).toBe('@timestamp');
          expect(options.jsonData.maxConcurrentShardRequests).toBe(5);
          expect(options.jsonData.pplEnabled).toBe(true);
        }}
        options={options}
      />
    );
  });

  it('should not apply default if values are set', () => {
    const onChange = jest.fn();

    mount(<ConfigEditor onOptionsChange={onChange} options={createDefaultConfigOptions()} />);

    expect(onChange).toHaveBeenCalledTimes(0);
  });
});
