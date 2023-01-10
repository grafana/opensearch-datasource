import {
  isMetricAggregationWithField,
  MetricAggregation,
} from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';

export const describeMetric = (metric: MetricAggregation) => {
  if (!isMetricAggregationWithField(metric)) {
    return metricAggregationConfig[metric.type].label;
  }

  // TODO: field might be undefined
  return `${metricAggregationConfig[metric.type].label} ${metric.field}`;
};

/**
 * Utility function to clean up aggregations settings objects.
 * It removes nullish values and empty strings, array and objects
 * recursing over nested objects (not arrays).
 * @param obj
 */
export const removeEmpty = <T>(obj: T): Partial<T> =>
  Object.entries(obj).reduce((acc, [key, value]) => {
    // Removing nullish values (null & undefined)
    if (value == null) {
      return { ...acc };
    }

    // Removing empty arrays (This won't recurse the array)
    if (Array.isArray(value) && value.length === 0) {
      return { ...acc };
    }

    // Removing empty strings
    if (value?.length === 0) {
      return { ...acc };
    }

    // Recursing over nested objects
    if (!Array.isArray(value) && typeof value === 'object') {
      const cleanObj = removeEmpty(value);

      if (Object.keys(cleanObj).length === 0) {
        return { ...acc };
      }

      return { ...acc, [key]: cleanObj };
    }

    return {
      ...acc,
      [key]: value,
    };
  }, {});

export async function sha256(string) {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(bytes => bytes.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
