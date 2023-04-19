import {
  DataFrame,
  DataFrameDTO,
  DataQueryResponse,
  FieldType,
  MutableDataFrame,
  TraceKeyValuePair,
  TraceLog,
  TraceSpanRow,
} from '@grafana/data';
import { set } from 'lodash';
import { LuceneQueryType, OpenSearchQuery, OpenSearchSpan, OpenSearchSpanEvent, QueryType } from 'types';
import { createEmptyDataFrame } from 'utils';
import { addPreferredVisualisationType } from '../OpenSearchResponse';

type TraceGroupBucket = {
  key: string;
};
type TraceBucket = {
  key: string;
  trace_group: {
    buckets: TraceGroupBucket[];
  };
  latency: {
    value: number;
  };
  error_count: {
    doc_count: number;
  };
  last_updated: {
    value: string;
  };
};

export type TraceListResponse = {
  aggregations: {
    traces: {
      buckets: TraceBucket[];
    };
  };
};

export const createListTracesDataFrame = (
  targets: OpenSearchQuery[],
  response: { responses: TraceListResponse[] },
  uid: string,
  name: string,
  type: string
): DataQueryResponse => {
  function createDataFrame(response: TraceListResponse, refId: string) {
    const traceIds = [];
    const traceGroups = [];
    const latency = [];
    const errors = [];
    const lastUpdated = [];

    response.aggregations.traces.buckets.forEach(bucket => {
      traceIds.push(bucket.key);
      traceGroups.push(bucket.trace_group.buckets[0].key);
      latency.push(bucket.latency.value);
      errors.push(bucket.error_count.doc_count);
      lastUpdated.push(bucket.last_updated.value);
    });

    const traceFields: DataFrameDTO = {
      meta: {
        preferredVisualisationType: 'table',
      },
      refId,
      fields: [
        {
          name: 'Trace Id',
          type: FieldType.string,
          values: traceIds,
          config: {
            links: [
              {
                title: 'Trace: ${__value.raw}',
                url: '',
                internal: {
                  datasourceUid: uid,
                  datasourceName: name,
                  query: {
                    datasource: {
                      uid,
                      type,
                    },
                    query: 'traceId: ${__value.raw}',
                    luceneQueryType: LuceneQueryType.Traces,
                  },
                },
              },
            ],
          },
        },
        { name: 'Trace Group', type: FieldType.string, values: traceGroups },
        { name: 'Latency (ms)', type: FieldType.number, values: latency },
        // TODO: { name: 'Percentile in trace group', type: FieldType.string, values: ['todo'] },
        { name: 'Error Count', type: FieldType.number, values: errors },
        { name: 'Last Updated', type: FieldType.time, values: lastUpdated },
      ],
    };
    return new MutableDataFrame(traceFields);
  }
  // if multiple targets of type traceList, map them into data
  const dataFrames = response.responses.map((res, index) => createDataFrame(res, targets[index].refId));

  return { data: dataFrames, key: targets[0].refId };
};

export const createTraceDataFrame = (
  targets,
  response: { responses: Array<{ hits: { hits: OpenSearchSpan[] } }> }
): DataQueryResponse => {
  function getDataFrameForTarget(target, response) {
    // first, transform Open Search response to fields Grafana Trace View plugin understands
    const spans = transformTraceResponse(response);

    const spanFields = [
      'traceID',
      'serviceName',
      'parentSpanID',
      'spanID',
      'operationName',
      'startTime',
      'duration',
      'tags',
      'serviceTags',
      'stackTraces',
      'logs',
    ];

    let series = createEmptyDataFrame(spanFields, '', false, QueryType.Lucene);
    const dataFrames: DataFrame[] = [];
    // Add a row for each document
    for (const doc of spans) {
      series.add(doc);
    }
    series.refId = target.refId;
    series = addPreferredVisualisationType(series, 'trace');
    dataFrames.push(series);
    return dataFrames;
  }
  // if multiple targets of type: trace, flatMap them into data(should be a single array with all trace data frames)
  const data = targets.flatMap((target, index) => getDataFrameForTarget(target, response.responses[index].hits.hits));

  return { data, key: targets[0].refId };
};

function transformTraceResponse(spanList: OpenSearchSpan[]): TraceSpanRow[] {
  return spanList.map(span => {
    const spanData = span._source;
    // some k:v pairs come from OpenSearch in dot notation: 'span.attributes.http@status_code': 200,
    // namely TraceSpanRow.Attributes and TraceSpanRow.Resource
    // this turns everything into objects we can group and display
    const nestedSpan = {} as OpenSearchSpan['_source'];
    Object.keys(spanData).map(key => {
      set(nestedSpan, key, spanData[key]);
    });
    const hasError = nestedSpan.events ? spanHasError(nestedSpan.events) : false;

    return {
      parentSpanID: nestedSpan.parentSpanId,
      traceID: nestedSpan.traceId,
      spanID: nestedSpan.spanId,
      operationName: nestedSpan.name,
      // grafana needs time in milliseconds
      startTime: new Date(nestedSpan.startTime).getTime(),
      duration: nestedSpan.durationInNanos * 0.000001,
      serviceName: nestedSpan.serviceName,
      tags: [
        ...convertToKeyValue(nestedSpan.span?.attributes ?? {}),
        // TraceView needs a true or false value here to display the error icon next to the span
        { key: 'error', value: hasError },
      ],
      serviceTags: nestedSpan.resource?.attributes ? convertToKeyValue(nestedSpan.resource.attributes) : [],
      ...(hasError ? { stackTraces: getStackTraces(nestedSpan.events) } : {}),
      logs: nestedSpan.events.length ? transformEventsIntoLogs(nestedSpan.events) : [],
    };
  });
}

function spanHasError(spanEvents: OpenSearchSpanEvent[]): boolean {
  return spanEvents.some(event => event.attributes.error);
}

function getStackTraces(events: OpenSearchSpanEvent[]): string[] | undefined {
  const stackTraces = events
    .filter(event => event.attributes.error)
    .map(event => `${event.name}: ${event.attributes.error}`);
  // if we return an empty array, Trace panel plugin shows "0"
  return stackTraces.length > 0 ? stackTraces : undefined;
}

function convertToKeyValue(tags: Record<string, any>): TraceKeyValuePair[] {
  return Object.keys(tags).map(key => ({
    key,
    value: tags[key],
  }));
}

function transformEventsIntoLogs(events: OpenSearchSpanEvent[]): TraceLog[] {
  return events.map(event => ({
    timestamp: new Date(event.time).getTime(),
    fields: [{ key: 'name', value: event.name }],
  }));
}
