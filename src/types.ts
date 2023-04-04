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
  luceneQueryType?: LuceneQueryType;
  luceneQueryObj?: LuceneQueryObj;
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

// TODO add raw data and logs
export enum LuceneQueryType {
  Traces = 'Traces',
  Metric = 'Metric',
}

export type LuceneQueryObj = {
  size: number;
  query: DSLQuery;
  // TODO we could type this further, default trace queries are very hard coded right now and do not change much.
  // but maybe it makes more sense to revisit typing this once we support more than just traces
  aggs?: unknown;
};

export type DSLQuery = {
  bool: DSLBool;
};

export type DSLBool = {
  must: DSLMust[];
  filter: [];
  should: [];
  must_not: [];
};

export type DSLMust = DSLRange | DSLTerm;

export type DSLRange = {
  range: {
    startTime: { gte: '$timeFrom'; lte: '$timeTo' };
  };
};

export type DSLTerm = {
  term: {
    traceId: string;
  };
};

export interface OpenSearchSpanEvent {
  name: string;
  time: string; //ISO String
  attributes: {
    level: string;
    error?: string;
  };
}
export interface OpenSearchSpan {
  traceId: string;
  serviceName: string;
  parentSpanId: string;
  spanId: string;
  name: string;
  startTime: string;
  durationInNanos: number;
  events: OpenSearchSpanEvent[];
  // will be mapped to serviceTags - "Resource" in TraceView
  resource?: {
    attributes: Record<string, any>;
  };
  // will be mapped to tags - "Attributes" in TraceView
  span?: {
    attributes: Record<string, any>;
  };
  [key: string]: any;
}
