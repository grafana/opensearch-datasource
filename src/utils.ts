import {
  isMetricAggregationWithField,
  MetricAggregation,
} from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';
import { QueryType } from './types';
import { FieldType, MutableDataFrame } from '@grafana/data';

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

/**
 * Create empty dataframe but with created fields. Fields are based from propNames (should be from the response) and
 * also from configuration specified fields for message, time, and level.
 * @param propNames
 * @param timeField
 * @param logMessageField
 * @param logLevelField
 */
export const createEmptyDataFrame = (
  propNames: string[],
  isLogsRequest: boolean,
  targetType: QueryType,
  logMessageField?: string,
  logLevelField?: string,
  timeField?: string
): MutableDataFrame => {
  const series = new MutableDataFrame({ fields: [] });

  //PPL table response should add time field only when it is part of the query response
  if (timeField && (targetType === QueryType.Lucene || isLogsRequest)) {
    series.addField({
      config: {
        filterable: true,
      },
      name: timeField,
      type: FieldType.time,
    });
  }

  if (logMessageField) {
    series.addField({
      name: logMessageField,
      type: FieldType.string,
    });
  }

  if (logLevelField) {
    series.addField({
      name: 'level',
      type: FieldType.string,
    });
  }

  const fieldNames = series.fields.map(field => field.name);

  for (const propName of propNames) {
    // Do not duplicate fields. This can mean that we will shadow some fields.
    if (fieldNames.includes(propName)) {
      continue;
    }
    // Do not add _source field (besides logs) as we are showing each _source field in table instead.
    if (!isLogsRequest && propName === '_source') {
      continue;
    }

    series.addField({
      config: {
        filterable: true,
      },
      name: propName,
      type: FieldType.string,
    });
  }

  return series;
};
