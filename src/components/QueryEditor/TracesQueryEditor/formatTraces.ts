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
import { OpenSearchSpan, OpenSearchSpanEvent, QueryType } from 'types';
import { createEmptyDataFrame } from 'utils';

export const createTracesDataFrame = (targets, response): DataQueryResponse => {
  const traceIds = [];
  const traceGroups = [];
  const latency = [];
  const errors = [];
  const lastUpdated = [];

  // TODO: right now we only handle response[0], should we support multiple responses? What might that look like?
  response[0].aggregations.traces.buckets.forEach(bucket => {
    traceIds.push(bucket.key);
    traceGroups.push(bucket.trace_group.buckets[0].key);
    latency.push(bucket.latency.value);
    errors.push(bucket.error_count.doc_count);
    lastUpdated.push(bucket.last_updated.value);
  });

  const traceFields: DataFrameDTO = {
    fields: [
      { name: 'Trace Id', type: FieldType.string, values: traceIds },
      { name: 'Trace Group', type: FieldType.string, values: traceGroups },
      { name: 'Latency (ms)', type: FieldType.number, values: latency },
      // { name: 'Percentile in trace group', type: FieldType.string, values: ['todo'] },
      { name: 'Error Count', type: FieldType.number, values: errors },
      { name: 'Last Updated', type: FieldType.time, values: lastUpdated },
    ],
  };
  const dataFrames = new MutableDataFrame(traceFields);
  return { data: [dataFrames], key: targets[0].refId };
};

export const createTraceDataFrame = (targets, response): DataQueryResponse => {
  const spanFields = [
    'traceID',
    'durationInNanos',
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
  const spans = transformTraceResponse(response[0].hits.hits);
  // Add a row for each document
  for (const doc of spans) {
    series.add(doc);
  }
  // do we need this?
  series.refId = targets[0].refId;
  dataFrames.push(series);

  return { data: dataFrames, key: targets[0].refId };
};

function transformTraceResponse(spanList: OpenSearchSpan[]): TraceSpanRow[] {
  return spanList.map(span => {
    const spanData = span._source;
    // some k:v pairs come from OpenSearch in dot notation: 'span.attributes.http@status_code': 200,
    // namely TraceSpanRow.Attributes and TraceSpanRow.Resource
    // this turns everything into objects we can group and display
    const nestedSpan = {} as OpenSearchSpan;
    Object.keys(spanData).map(key => {
      set(nestedSpan, key, spanData[key]);
    });
    const hasError = nestedSpan.events ? spanHasError(nestedSpan.events) : false;

    return {
      ...nestedSpan,
      parentSpanID: nestedSpan.parentSpanId,
      traceID: nestedSpan.traceId,
      spanID: nestedSpan.spanId,
      operationName: nestedSpan.name,
      // grafana needs time in milliseconds
      startTime: new Date(nestedSpan.startTime).getTime(),
      duration: nestedSpan.durationInNanos * 0.000001,
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

function getStackTraces(events: OpenSearchSpanEvent[]) {
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
