import { DataSourceSettings } from '@grafana/data';
import { Flavor, OpenSearchOptions } from '../types';
import { coerceOptions } from './utils';

describe('coerceOptions', () => {
  it('should set version if serverless', () => {
    const options: DataSourceSettings<OpenSearchOptions, {}> = {
      id: 0,
      uid: '',
      orgId: 0,
      name: '',
      typeLogoUrl: '',
      type: '',
      typeName: '',
      access: '',
      url: '',
      user: '',
      database: '',
      basicAuth: false,
      basicAuthUser: '',
      isDefault: false,
      jsonData: {
        database: '',
        timeField: '',
        version: '',
        // flavor isn't optional and isn't settable to a null equivalents
        flavor: Flavor.OpenSearch,
        timeInterval: '',
      },
      secureJsonFields: {},
      readOnly: false,
      withCredentials: false,
    };
    options.jsonData.serverless = true;

    const result = coerceOptions(options);
    expect(result.jsonData.flavor).toEqual(Flavor.OpenSearch);
    expect(result.jsonData.version).toEqual('1.0.0');
  });
});

describe('coerceOptions query language defaults', () => {
  const settings = (jsonData: Partial<OpenSearchOptions>) =>
    ({
      jsonData: {
        database: '',
        timeField: '@timestamp',
        version: '3.0.0',
        flavor: Flavor.OpenSearch,
        ...jsonData,
      },
    } as unknown as DataSourceSettings<OpenSearchOptions, {}>);

  it('enables a query language when the setting is absent', () => {
    const result = coerceOptions(settings({}));

    // A data source configured before SQL existed has no setting, and its users
    // can already pick a query type, so the language is on unless it is turned off.
    expect(result.jsonData.sqlEnabled).toBe(true);
    expect(result.jsonData.pplEnabled).toBe(true);
  });

  it('keeps a query language that is turned off turned off', () => {
    const result = coerceOptions(settings({ sqlEnabled: false, pplEnabled: false }));

    expect(result.jsonData.sqlEnabled).toBe(false);
    expect(result.jsonData.pplEnabled).toBe(false);
  });
});
