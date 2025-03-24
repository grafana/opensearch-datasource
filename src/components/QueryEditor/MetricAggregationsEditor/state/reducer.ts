import { Action } from '@reduxjs/toolkit';
import { defaultMetricAgg } from '../../../../query_def';
import { OpenSearchQuery } from '../../../../types';
import { removeEmpty } from '../../../../utils';
import { initQuery } from '../../state';
import { isMetricAggregationWithMeta, isMetricAggregationWithSettings, MetricAggregation } from '../aggregations';
import { getChildren, metricAggregationConfig } from '../utils';
import {
  addMetric,
  removeMetric,
  changeMetricType,
  changeMetricField,
  toggleMetricVisibility,
  changeMetricAttribute,
  changeMetricSetting,
  changeMetricMeta,
} from './actions';
import { updateLuceneTypeAndMetrics } from 'components/QueryEditor/LuceneQueryEditor/state';

export const reducer = (state: OpenSearchQuery['metrics'], action: Action): OpenSearchQuery['metrics'] => {
  if (addMetric.match(action)) {
    return [...(state || []), defaultMetricAgg(action.payload)];
  }

  if (removeMetric.match(action)) {
    const metricToRemove = state?.find((m) => m.id === action.payload)!;
    const metricsToRemove = [metricToRemove, ...getChildren(metricToRemove, state || [])];
    const resultingMetrics = state?.filter((metric) => !metricsToRemove.some((toRemove) => toRemove.id === metric.id));
    if (resultingMetrics?.length === 0) {
      return [defaultMetricAgg('1')];
    }
    return resultingMetrics;
  }

  if (changeMetricType.match(action) || updateLuceneTypeAndMetrics.match(action)) {
    return getNewMetrics(state || [], action.payload.id, action.payload.type);
  }

  if (changeMetricField.match(action)) {
    return state?.map((metric) => {
      if (metric.id !== action.payload.id) {
        return metric;
      }

      return {
        ...metric,
        field: action.payload.field,
      };
    });
  }

  if (toggleMetricVisibility.match(action)) {
    return state?.map((metric) => {
      if (metric.id !== action.payload) {
        return metric;
      }

      return {
        ...metric,
        hide: !metric.hide,
      };
    });
  }

  if (changeMetricAttribute.match(action)) {
    return state?.map((metric) => {
      if (metric.id !== action.payload.metric.id) {
        return metric;
      }

      return {
        ...metric,
        [action.payload.attribute]: action.payload.newValue,
      };
    });
  }

  if (changeMetricSetting.match(action)) {
    // @ts-ignore
    return state.map((metric) => {
      if (metric.id !== action.payload.metric.id) {
        return metric;
      }

      // TODO: Here, instead of this if statement, we should assert that metric is MetricAggregationWithSettings
      if (isMetricAggregationWithSettings(metric)) {
        const newSettings = removeEmpty({
          ...metric.settings,
          [action.payload.settingName]: action.payload.newValue,
        });

        return {
          ...metric,
          settings: {
            ...newSettings,
          },
        };
      }

      // This should never happen.
      return metric;
    });
  }

  if (changeMetricMeta.match(action)) {
    return state?.map((metric) => {
      if (metric.id !== action.payload.metric.id) {
        return metric;
      }

      // TODO: Here, instead of this if statement, we should assert that metric is MetricAggregationWithMeta
      if (isMetricAggregationWithMeta(metric)) {
        return {
          ...metric,
          meta: {
            ...metric.meta,
            [action.payload.meta]: action.payload.newValue,
          },
        };
      }

      // This should never happen.
      return metric;
    });
  }

  if (initQuery.match(action)) {
    if (state?.length || 0 > 0) {
      return state;
    }
    return [defaultMetricAgg('1')];
  }

  return state;
};

export const getNewMetrics = (
  currentMetrics: MetricAggregation[],
  metricId: string,
  metricType: MetricAggregation['type']
) => {
  return currentMetrics
    ?.filter((metric) =>
      // When the new metric type is `isSingleMetric` we remove all other metrics from the query
      // leaving only the current one.
      !!metricAggregationConfig[metricType].isSingleMetric ? metric.id === metricId : true
    )
    .map((metric) => {
      if (metric.id !== metricId) {
        return metric;
      }

      /*
        TODO: The previous version of the query editor was keeping some of the old metric's configurations
        in the new selected one (such as field or some settings).
        It the future would be nice to have the same behavior but it's hard without a proper definition,
        as OpenSearch will error sometimes if some settings are not compatible.
      */
      return {
        id: metric.id,
        type: metricType,
        ...metricAggregationConfig[metricType].defaults,
      } as MetricAggregation;
    });
};
