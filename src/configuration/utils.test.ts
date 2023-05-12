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
      secureJsonFields: undefined,
      readOnly: false,
      withCredentials: false,
    };
    options.jsonData.serverless = true;

    const result = coerceOptions(options);
    expect(result.jsonData.flavor).toEqual(Flavor.OpenSearch);
    expect(result.jsonData.version).toEqual('1.0.0');
  });
});
