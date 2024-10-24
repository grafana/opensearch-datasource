import { createAction } from '@reduxjs/toolkit';
import { BucketAggregation, BucketAggregationWithField } from '../aggregations';
import {
  ADD_BUCKET_AGG,
  REMOVE_BUCKET_AGG,
  CHANGE_BUCKET_AGG_TYPE,
  CHANGE_BUCKET_AGG_FIELD,
  CHANGE_BUCKET_AGG_SETTING,
} from './types';

export const addBucketAggregation = createAction<string>(ADD_BUCKET_AGG);

export const removeBucketAggregation = createAction<string>(REMOVE_BUCKET_AGG);

export const changeBucketAggregationType = createAction<{
  id: BucketAggregation['id'];
  newType: BucketAggregation['type'];
}>(CHANGE_BUCKET_AGG_TYPE);

export const changeBucketAggregationField = createAction<{
  id: BucketAggregationWithField['id'];
  newField: BucketAggregationWithField['field'];
}>(CHANGE_BUCKET_AGG_FIELD);

export const changeBucketAggregationSetting = createAction<{
  bucketAgg: BucketAggregation;
  settingName: string;
  newValue: string | string[] | unknown;
}>(CHANGE_BUCKET_AGG_SETTING);
