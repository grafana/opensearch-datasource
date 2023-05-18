import React from 'react';
import { mount, shallow } from 'enzyme';
import { ConfigEditor } from './ConfigEditor';
import { DataSourceHttpSettings } from '@grafana/ui';
import { OpenSearchDetails } from './OpenSearchDetails';
import { LogsConfig } from './LogsConfig';
import { createDefaultConfigOptions } from '__mocks__/DefaultConfigOptions';
import { render } from '@testing-library/react';

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

    delete options.jsonData.flavor;
    delete options.jsonData.version;
    delete options.jsonData.timeField;
    delete options.jsonData.maxConcurrentShardRequests;
    delete options.jsonData.pplEnabled;

    render(
      <ConfigEditor
        onOptionsChange={options => {
          expect(options.jsonData.flavor).toBe(undefined);
          expect(options.jsonData.version).toBe(null);
          expect(options.jsonData.timeField).toBe('@timestamp');
          expect(options.jsonData.maxConcurrentShardRequests).toBe(0);
          expect(options.jsonData.pplEnabled).toBe(true);
        }}
        options={options}
      />
    );
    expect.assertions(5);
  });

  it('should set serverless defaults', () => {
    const options = createDefaultConfigOptions();

    delete options.jsonData.flavor;
    delete options.jsonData.version;
    delete options.jsonData.timeField;
    delete options.jsonData.maxConcurrentShardRequests;
    delete options.jsonData.pplEnabled;
    options.jsonData.serverless = true;

    render(
      <ConfigEditor
        onOptionsChange={options => {
          expect(options.jsonData.flavor).toBe('opensearch');
          expect(options.jsonData.version).toBe('1.0.0');
          expect(options.jsonData.timeField).toBe('@timestamp');
          expect(options.jsonData.maxConcurrentShardRequests).toBe(5);
          expect(options.jsonData.pplEnabled).toBe(true);
        }}
        options={options}
      />
    );
    expect.assertions(5);
  });

  it('should not apply default if values are set', () => {
    const onChange = jest.fn();

    mount(<ConfigEditor onOptionsChange={onChange} options={createDefaultConfigOptions()} />);

    expect(onChange).toHaveBeenCalledTimes(0);
  });
});
