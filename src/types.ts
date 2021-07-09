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

export interface ElasticsearchOptions extends DataSourceJsonData {
  database: string;
  timeField: string;
  esVersion: number;
  interval?: string;
  timeInterval: string;
  maxConcurrentShardRequests?: number;
  logMessageField?: string;
  logLevelField?: string;
  dataLinks?: DataLinkConfig[];
  pplEnabled?: boolean;
}

interface MetricConfiguration<T extends MetricAggregationType> {
  label: string;
  requiresField: boolean;
  supportsInlineScript: boolean;
  supportsMissing: boolean;
  isPipelineAgg: boolean;
  minVersion?: number;
  maxVersion?: number;
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
  [P in ElasticsearchQueryType]: { label: string };
};

export type FormatConfiguration = {
  [P in PPLFormatType]: { label: string };
};

export interface ElasticsearchAggregation {
  id: string;
  type: MetricAggregationType | BucketAggregationType;
  settings?: unknown;
  field?: string;
  hide: boolean;
}

export interface ElasticsearchQuery extends DataQuery {
  isLogsQuery?: boolean;
  alias?: string;
  query?: string;
  bucketAggs?: BucketAggregation[];
  metrics?: MetricAggregation[];
  timeField?: string;
  queryType?: ElasticsearchQueryType;
  format?: PPLFormatType;
}

export type DataLinkConfig = {
  field: string;
  url: string;
  datasourceUid?: string;
};

export enum ElasticsearchQueryType {
  Lucene = 'lucene',
  PPL = 'PPL',
}

export interface PromQuery extends DataQuery {
  expr: string;
  format?: string;
  instant?: boolean;
  range?: boolean;
  hinting?: boolean;
  interval?: string;
  intervalFactor?: number;
  legendFormat?: string;
  valueWithRefId?: boolean;
  requestId?: string;
  showingGraph?: boolean;
  showingTable?: boolean;
}
