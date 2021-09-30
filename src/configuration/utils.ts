import { DataSourceSettings, SelectableValue } from '@grafana/data';
import { valid } from 'semver';
import { Flavor, OpenSearchOptions } from '../types';
import { defaultMaxConcurrentShardRequests } from './OpenSearchDetails';

export const coerceOptions = (
  options: DataSourceSettings<OpenSearchOptions, {}>
): DataSourceSettings<OpenSearchOptions, {}> => {
  const flavor = options.jsonData.flavor || Flavor.OpenSearch;
  const version =
    valid(options.jsonData.version) ||
    AVAILABLE_VERSIONS.find(v => v.value.flavor === flavor)?.value.version ||
    AVAILABLE_VERSIONS[AVAILABLE_VERSIONS.length - 1].value.version;

  return {
    ...options,
    jsonData: {
      ...options.jsonData,
      timeField: options.jsonData.timeField || '@timestamp',
      version,
      flavor,
      maxConcurrentShardRequests:
        options.jsonData.maxConcurrentShardRequests || defaultMaxConcurrentShardRequests(flavor, version),
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

interface Version {
  version: string;
  flavor: Flavor;
}

export const AVAILABLE_VERSIONS: Array<SelectableValue<Version>> = [
  {
    label: 'OpenSearch 1.0.x',
    value: {
      flavor: Flavor.OpenSearch,
      version: '1.0.0',
    },
  },
  {
    label: 'Elasticsearch 7.0+',
    value: {
      flavor: Flavor.Elasticsearch,
      version: '7.0.0',
    },
  },
  {
    label: 'Elasticsearch 6.0+',
    value: {
      flavor: Flavor.Elasticsearch,
      version: '6.0.0',
    },
  },
  {
    label: 'Elasticsearch 5.6+',
    value: {
      flavor: Flavor.Elasticsearch,
      version: '5.6.0',
    },
  },
  {
    label: 'Elasticsearch 5.0+',
    value: {
      flavor: Flavor.Elasticsearch,
      version: '5.0.0',
    },
  },
  {
    label: 'Elasticsearch 2.0+',
    value: {
      flavor: Flavor.Elasticsearch,
      version: '2.0.0',
    },
  },
];

export const AVAILABLE_FLAVORS: Array<SelectableValue<string>> = [
  { label: 'OpenSearch', value: Flavor.OpenSearch },
  { label: 'ElasticSearch', value: Flavor.Elasticsearch },
];
