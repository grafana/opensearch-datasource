import { DataQuery, DataSourceJsonData } from '@grafana/data';
import {
  BucketAggregation,
  BucketAggregationType,
} from './components/QueryEditor/BucketAggregationsEditor/aggregations';
import {
  MetricAggregation,
  MetricAggregationType,
} from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { PPLFormatType } from './components/QueryEditor/PPLFormatEditor/formats';

export interface OpenSearchOptions extends DataSourceJsonData {
  database: string;
  timeField: string;
  version: string;
  flavor: Flavor;
  interval?: string;
  timeInterval: string;
  maxConcurrentShardRequests?: number;
  logMessageField?: string;
  logLevelField?: string;
  dataLinks?: DataLinkConfig[];
  pplEnabled?: boolean;
  sigV4Auth?: boolean;
  serverless?: boolean;
}

interface MetricConfiguration<T extends MetricAggregationType> {
  label: string;
  requiresField: boolean;
  supportsInlineScript: boolean;
  supportsMissing: boolean;
  isPipelineAgg: boolean;
  /**
   * A key-value pair of flavor and a valid semver range for which the metric is known to be available.
   * If omitted defaults to '*'.
   */
  versionRange?: {
    [key in Flavor]?: string;
  };
  supportsMultipleBucketPaths: boolean;
  isSingleMetric?: boolean;
  hasSettings: boolean;
  hasMeta: boolean;
  defaults: Omit<Extract<MetricAggregation, { type: T }>, 'id' | 'type'>;
}

type BucketConfiguration<T extends BucketAggregationType> = {
  label: string;
  requiresField: boolean;
  defaultSettings: Extract<BucketAggregation, { type: T }>['settings'];
};

export type MetricsConfiguration = {
  [P in MetricAggregationType]: MetricConfiguration<P>;
};

export type BucketsConfiguration = {
  [P in BucketAggregationType]: BucketConfiguration<P>;
};

export type QueryTypeConfiguration = {
  [P in QueryType]: { label: string };
};

export type FormatConfiguration = {
  [P in PPLFormatType]: { label: string };
};

export type Aggregation = MetricAggregation | BucketAggregation;

export interface OpenSearchQuery extends DataQuery {
  isLogsQuery?: boolean;
  alias?: string;
  query?: string;
  bucketAggs?: BucketAggregation[];
  metrics?: MetricAggregation[];
  timeField?: string;
  queryType?: QueryType;
  format?: PPLFormatType;
}

export type DataLinkConfig = {
  field: string;
  url: string;
  datasourceUid?: string;
};

export enum QueryType {
  Lucene = 'lucene',
  PPL = 'PPL',
}

export enum Flavor {
  Elasticsearch = 'elasticsearch',
  OpenSearch = 'opensearch',
}
