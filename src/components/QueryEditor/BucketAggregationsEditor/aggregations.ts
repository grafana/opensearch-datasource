import { bucketAggregationConfig } from './utils';

export type BucketAggregationType = 'terms' | 'filters' | 'geohash_grid' | 'date_histogram' | 'histogram';

interface BaseBucketAggregation {
  id: string;
  type: BucketAggregationType;
  settings?: Record<string, unknown>;
}

export interface BucketAggregationWithField extends BaseBucketAggregation {
  field?: string;
}

export interface DateHistogram extends BucketAggregationWithField {
  type: 'date_histogram';
  settings?: {
    interval?: string;
    min_doc_count?: string;
    trimEdges?: string;
    offset?: string;
  };
}

export interface Histogram extends BucketAggregationWithField {
  type: 'histogram';
  settings?: {
    interval?: string;
    min_doc_count?: string;
  };
}

export type TermsOrder = 'desc' | 'asc';

export interface Terms extends BucketAggregationWithField {
  type: 'terms';
  settings?: {
    order?: TermsOrder;
    size?: string;
    min_doc_count?: string;
    orderBy?: string;
    missing?: string;
    execution_hint?: string;
  };
}

export type Filter = {
  query: string;
  label: string;
};
export interface Filters extends BaseBucketAggregation {
  type: 'filters';
  settings?: {
    filters?: Filter[];
  };
}

interface GeoHashGrid extends BucketAggregationWithField {
  type: 'geohash_grid';
  settings?: {
    precision?: string;
  };
}

export type BucketAggregation = DateHistogram | Histogram | Terms | Filters | GeoHashGrid;

export const isBucketAggregationWithField = (
  bucketAgg: BucketAggregation | BucketAggregationWithField
): bucketAgg is BucketAggregationWithField => bucketAggregationConfig[bucketAgg.type].requiresField;
