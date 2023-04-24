import { DataSourceSettings } from '@grafana/data';
import { Flavor, OpenSearchOptions } from '../types';
import { createDatasourceSettings } from '../dependencies/mocks';

export function createDefaultConfigOptions(
  options?: Partial<OpenSearchOptions>
): DataSourceSettings<OpenSearchOptions> {
  return createDatasourceSettings<OpenSearchOptions>({
    timeField: '@time',
    flavor: Flavor.OpenSearch,
    version: '1.0.0',
    interval: 'Hourly',
    timeInterval: '10s',
    maxConcurrentShardRequests: 300,
    logMessageField: 'test.message',
    logLevelField: 'test.level',
    database: '',
    pplEnabled: false,
    serverless: false,
    ...options,
  });
}
