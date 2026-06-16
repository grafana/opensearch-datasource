import { getDataSourceSrv } from '@grafana/runtime';
import {
  isMetricAggregationWithField,
  MetricAggregation,
} from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';
import { DataLinkConfig, LuceneQueryType, OpenSearchQuery, QueryType } from './types';
import { DataFrame, DataLink, DataQueryResponse, FieldType, MutableDataFrame } from '@grafana/data';
import { defaultBucketAgg, defaultMetricAgg } from './query_def';

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
export const removeEmpty = <T extends {}>(obj: T): Partial<T> =>
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
    if (typeof value === 'string' && value?.length === 0) {
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

export async function sha256(string: string) {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((bytes) => bytes.toString(16).padStart(2, '0')).join('');
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

  const fieldNames = series.fields.map((field) => field.name);

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

export function enhanceDataFramesWithDataLinks(
  newResponse: DataQueryResponse,
  dataLinks: DataLinkConfig[],
  dsUid: string,
  dsName: string,
  dsType: string
) {
  return {
    ...newResponse,
    data: newResponse.data.map((dataFrame) => {
      return enhanceDataFrameWithDataLinks(dataFrame, dataLinks, dsUid, dsName, dsType);
    }),
  };
}

function enhanceDataFrameWithDataLinks(
  dataFrame: DataFrame,
  dataLinks: DataLinkConfig[],
  dsUid: string,
  dsName: string,
  dsType: string
): DataFrame {
  const hasConfiguredDataLinks = dataLinks.length > 0;
  const hasTraceListDataLinks =
    dataFrame.name === 'Trace List' &&
    dataFrame.fields.some((field) =>
      field.config.links?.some((link) => link.title === 'Trace: ${__value.raw}' && !link.internal && !link.url)
    );

  if (!hasConfiguredDataLinks && !hasTraceListDataLinks) {
    return dataFrame;
  }

  const newDataFrame = { ...dataFrame };
  if (hasConfiguredDataLinks) {
    const newFields = newDataFrame.fields.map((field) => {
      const linksToApply = dataLinks.filter((dataLink) => new RegExp(dataLink.field).test(field.name));

      if (linksToApply.length === 0) {
        return field;
      }
      return {
        ...field,
        config: {
          ...field.config,
          links: [...(field.config.links || []), ...linksToApply.map(generateDataLink)],
        },
      };
    });

    newDataFrame.fields = newFields;
  }

  if (hasTraceListDataLinks) {
    const newFields = newDataFrame.fields.map((field) => {
      if (field.name !== 'Trace Id') {
        return field;
      }

      const newLinks = field.config.links?.map((link) => {
        if (link.title !== 'Trace: ${__value.raw}' || link.internal || link.url) {
          return link;
        }

        return {
          title: 'Trace: ${__value.raw}',
          url: '',
          internal: {
            datasourceUid: dsUid,
            datasourceName: dsName,
            query: {
              datasource: {
                uid: dsUid,
                type: dsType,
              },
              query: 'traceId: ${__value.raw}',
              luceneQueryType: LuceneQueryType.Traces,
              queryType: QueryType.Lucene,
              metrics: [defaultMetricAgg()],
              bucketAggs: [defaultBucketAgg()],
            },
          },
        };
      });

      return {
        ...field,
        config: {
          ...field.config,
          links: newLinks,
        },
      };
    });

    newDataFrame.fields = newFields;
  }

  return newDataFrame;
}

function generateDataLink(linkConfig: DataLinkConfig): DataLink {
  const dataSourceSrv = getDataSourceSrv();

  if (linkConfig.datasourceUid) {
    const dsSettings = dataSourceSrv.getInstanceSettings(linkConfig.datasourceUid);

    return {
      title: linkConfig.title ?? '',
      url: '',
      internal: {
        query: { query: linkConfig.url },
        datasourceUid: linkConfig.datasourceUid,
        datasourceName: dsSettings?.name ?? 'Data source not found',
      },
    };
  } else {
    return {
      title: linkConfig.title ?? '',
      url: linkConfig.url,
    };
  }
}

// To be considered a time series query, the last bucked aggregation must be a Date Histogram
export const isTimeSeriesQuery = (query: OpenSearchQuery): boolean => {
  return (
    (!query.luceneQueryType || query.luceneQueryType === LuceneQueryType.Metric) &&
    query?.bucketAggs?.slice(-1)[0]?.type === 'date_histogram'
  );
};
/**
 *  This function converts an order by string to the correct metric id For example,
 *  if the user uses the standard deviation extended stat for the order by,
 *  the value would be "1[std_deviation]" and this would return "1"
 */
export const convertOrderByToMetricId = (orderBy: string): string | undefined => {
  const metricIdMatches = orderBy.match(/^(\d+)/);
  return metricIdMatches?.[1];
};

// memoizes results of async calls based on the arguments passed to the function
export function memoizeAsync<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  getKey: (...args: Args) => string = (...args) => JSON.stringify(args),
  maxSize = 10
): (...args: Args) => Promise<Result> {
  const cache = new Map<string, Result>();

  return (...args: Args): Promise<Result> => {
    const key = getKey(...args);

    const cachedValue = cache.get(key);
    if (cachedValue) {
      return Promise.resolve(cachedValue);
    }

    const promise = fn(...args).then((result) => {
      cache.set(key, result);

      // Limit cache size
      if (cache.size > maxSize) {
        const firstKey = cache.keys().next().value; // delete first item in the cache
        if (firstKey) {
          cache.delete(firstKey);
        }
      }

      return result;
    });

    return promise;
  };
}
