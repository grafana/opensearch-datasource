import { DataSourceSettings } from '@grafana/data';
import { valid } from 'semver';
import { OpenSearchOptions } from '../types';
import { DEFAULT_MAX_CONCURRENT_SHARD_REQUESTS } from './OpenSearchDetails';

export const coerceOptions = (
  options: DataSourceSettings<OpenSearchOptions, {}>
): DataSourceSettings<OpenSearchOptions, {}> => {
  return {
    ...options,
    jsonData: {
      ...options.jsonData,
      timeField: options.jsonData.timeField || '@timestamp',
      version: valid(options.jsonData.version) || '1.0.0',
      maxConcurrentShardRequests: options.jsonData.maxConcurrentShardRequests || DEFAULT_MAX_CONCURRENT_SHARD_REQUESTS,
      logMessageField: options.jsonData.logMessageField || '',
      logLevelField: options.jsonData.logLevelField || '',
      pplEnabled: options.jsonData.pplEnabled ?? true,
    },
  };
};

export const isValidOptions = (options: DataSourceSettings<OpenSearchOptions, {}>): boolean => {
  return (
    // esVersion should be a valid semver string
    !!valid(options.jsonData.version) &&
    // timeField should not be empty or nullish
    !!options.jsonData.timeField &&
    // maxConcurrentShardRequests should be a number AND greater than 0
    !!options.jsonData.maxConcurrentShardRequests &&
    // message & level fields should be defined
    options.jsonData.logMessageField !== undefined &&
    options.jsonData.logLevelField !== undefined
  );
};
