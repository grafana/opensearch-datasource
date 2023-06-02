import { DataFrame, DataQuery, DataQueryResponse, DataSourceJsonData } from '@grafana/data';
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

export type AggsForTraces = {
  traces: {
    // each of those buckets in traces is sorted by a key of their traceId
    // they contain any document, in this case all the spans of a trace
    terms: {
      field: 'traceId';
      size: 100;
      order: { _key: 'asc' };
    };
    // within each of those buckets we create further aggregations based on what's in that bucket
    aggs: {
      // one of those aggregations is a metric we call latency which is based on the durationInNanos
      // this script was taken directly from the network tab in the traces dashboard
      latency: {
        max: {
          script: {
            source: "\n                if (doc.containsKey('traceGroupFields.durationInNanos') && !doc['traceGroupFields.durationInNanos'].empty) {\n                  return Math.round(doc['traceGroupFields.durationInNanos'].value / 10000) / 100.0\n                }\n                return 0\n                ";
            lang: 'painless';
          };
        };
      };
      // one of those aggregations is the first traceGroup value it finds in the bucket
      trace_group: {
        terms: {
          field: 'traceGroup';
          size: 1;
        };
      };
      // one of aggregations is the the number of items in the bucket that has a status code of 2
      error_count: {
        filter: { term: { 'traceGroupFields.statusCode': '2' } };
      };
      // one of those aggregations is the span with the max endTime
      last_updated: { max: { field: 'traceGroupFields.endTime' } };
    };
  };
};

export type LuceneQueryObj = {
  size: number;
  query: DSLQuery;
  aggs?: AggsForTraces;
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

export type DSLMust = DSLRange | DSLTerm | DSLQueryString;

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

export type DSLQueryString = {
  query_string: {
    analyze_wildcard: boolean;
    query: string;
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
  _source: {
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
  };
}

export type OpenSearchDataQueryResponse = Omit<DataQueryResponse, 'data'> & {
  data: DataFrame[];
};
