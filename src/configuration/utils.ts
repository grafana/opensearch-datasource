import { DataSourceSettings, SelectableValue } from '@grafana/data';
import { lt, valid } from 'semver';
import { Flavor, OpenSearchOptions } from '../types';

export const coerceOptions = (
  options: DataSourceSettings<OpenSearchOptions, {}>
): DataSourceSettings<OpenSearchOptions, {}> => {
  const flavor = options.jsonData.flavor || Flavor.OpenSearch;

  const version =
    valid(options.jsonData.version) || AVAILABLE_VERSIONS[flavor][AVAILABLE_VERSIONS[flavor].length - 1].value;

  return {
    ...options,
    jsonData: {
      ...options.jsonData,
      timeField: options.jsonData.timeField || '@timestamp',
      version,
      flavor,
      maxConcurrentShardRequests:
        options.jsonData.maxConcurrentShardRequests || defaultMaxConcurrentShardRequests(version, flavor),
      logMessageField: options.jsonData.logMessageField || '',
      logLevelField: options.jsonData.logLevelField || '',
      pplEnabled: options.jsonData.pplEnabled ?? true,
    },
  };
};

export const isValidOptions = (options: DataSourceSettings<OpenSearchOptions>): boolean => {
  return (
    // esVersion should be a valid semver string
    !!valid(options.jsonData.version) &&
    // timeField should not be empty or nullish
    !!options.jsonData.timeField &&
    // maxConcurrentShardRequests should be a number AND greater than 0
    !!options.jsonData.maxConcurrentShardRequests &&
    // message & level fields should be defined
    options.jsonData.logMessageField !== undefined &&
    options.jsonData.logLevelField !== undefined &&
    // PPLEnabled should be defined
    options.jsonData.pplEnabled !== undefined
  );
};

function defaultMaxConcurrentShardRequests(version: string, flavor: Flavor) {
  return lt(version, '7.0.0') && flavor === Flavor.Elasticsearch ? 256 : 5;
}

export const AVAILABLE_VERSIONS: Record<Flavor, Array<SelectableValue<string>>> = {
  [Flavor.OpenSearch]: [{ label: '1.0.x', value: '1.0.0' }],
  [Flavor.Elasticsearch]: [
    { label: '2.x', value: '2.0.0' },
    { label: '5.x', value: '5.0.0' },
    { label: '5.6+', value: '5.6.0' },
    { label: '6.0+', value: '6.0.0' },
    { label: '7.0+', value: '7.0.0' },
  ],
};

export const AVAILABLE_FLAVORS: Array<SelectableValue<string>> = [
  { label: 'OpenSearch', value: Flavor.OpenSearch },
  { label: 'ElasticSearch', value: Flavor.Elasticsearch },
];
