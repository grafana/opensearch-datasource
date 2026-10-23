import React from 'react';
import { ConfigEditor, applySavedDatasource } from './ConfigEditor';
import { createDefaultConfigOptions } from '__mocks__/DefaultConfigOptions';
import { render, screen } from '@testing-library/react';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginInteractionReporter: () => jest.fn(),
  getAppEvents: () => ({
    subscribe: () => ({ unsubscribe: jest.fn() }),
  }),
}));

describe('ConfigEditor', () => {
  it('merges the server-minted external ID from the save response', () => {
    const current = createDefaultConfigOptions();
    current.jsonData = {
      ...current.jsonData,
      sigV4AuthType: 'grafana_assume_role',
      sigV4UsePerDatasourceExternalId: true,
    } as typeof current.jsonData;

    const saved = createDefaultConfigOptions();
    saved.version = (current.version ?? 1) + 1;
    saved.jsonData = {
      ...current.jsonData,
      sigV4GrafanaExternalId: '5285-uid-abcdef0123456789',
    } as typeof saved.jsonData;

    const next = applySavedDatasource(current, saved);
    expect(next.version).toBe(saved.version);
    expect(next.jsonData.timeField).toBe(current.jsonData.timeField);
    expect((next.jsonData as { sigV4GrafanaExternalId?: string }).sigV4GrafanaExternalId).toBe(
      '5285-uid-abcdef0123456789'
    );
  });

  it('should render without error', () => {
    render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);
  });

  it('should render all parts of the config', () => {
    render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);
    expect(screen.getByText('HTTP')).toBeInTheDocument();
    expect(screen.getByText('OpenSearch details')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('should set defaults', () => {
    const options = createDefaultConfigOptions();

    // @ts-ignore
    delete options.jsonData.flavor;
    // @ts-ignore
    delete options.jsonData.version;
    // @ts-ignore
    delete options.jsonData.timeField;
    delete options.jsonData.maxConcurrentShardRequests;
    delete options.jsonData.pplEnabled;

    render(
      <ConfigEditor
        onOptionsChange={(options) => {
          expect(options.jsonData.flavor).toBe(undefined);
          expect(options.jsonData.version).toBe('');
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

    // @ts-ignore
    delete options.jsonData.flavor;
    // @ts-ignore
    delete options.jsonData.version;
    // @ts-ignore
    delete options.jsonData.timeField;
    delete options.jsonData.maxConcurrentShardRequests;
    delete options.jsonData.pplEnabled;
    options.jsonData.serverless = true;

    render(
      <ConfigEditor
        onOptionsChange={(options) => {
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

    render(<ConfigEditor onOptionsChange={onChange} options={createDefaultConfigOptions()} />);

    expect(onChange).toHaveBeenCalledTimes(0);
  });
});
