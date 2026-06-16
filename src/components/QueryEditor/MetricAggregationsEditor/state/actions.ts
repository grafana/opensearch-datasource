import { createAction } from '@reduxjs/toolkit';
import {
  ExtendedStatMetaType,
  MetricAggregation,
  MetricAggregationWithMeta,
  MetricAggregationWithSettings,
} from '../aggregations';
import {
  ADD_METRIC,
  CHANGE_METRIC_FIELD,
  CHANGE_METRIC_TYPE,
  REMOVE_METRIC,
  TOGGLE_METRIC_VISIBILITY,
  CHANGE_METRIC_SETTING,
  CHANGE_METRIC_META,
  CHANGE_METRIC_ATTRIBUTE,
} from './types';

export const addMetric = createAction<MetricAggregation['id']>(ADD_METRIC);

export const removeMetric = createAction<MetricAggregation['id']>(REMOVE_METRIC);

export const changeMetricType = createAction<{ id: MetricAggregation['id']; type: MetricAggregation['type'] }>(
  CHANGE_METRIC_TYPE
);

export const changeMetricField = createAction<{ id: MetricAggregation['id']; field: string }>(CHANGE_METRIC_FIELD);

export const toggleMetricVisibility = createAction<MetricAggregation['id']>(TOGGLE_METRIC_VISIBILITY);

export const changeMetricAttribute = createAction<{
  metric: MetricAggregation;
  attribute: string;
  newValue: unknown;
}>(CHANGE_METRIC_ATTRIBUTE);

export const changeMetricSetting = createAction<{
  metric: MetricAggregationWithSettings;
  settingName: string;
  newValue: unknown;
}>(CHANGE_METRIC_SETTING);

export const changeMetricMeta = createAction<{
  metric: MetricAggregationWithMeta;
  meta: ExtendedStatMetaType;
  newValue: string | number | boolean;
}>(CHANGE_METRIC_META);
