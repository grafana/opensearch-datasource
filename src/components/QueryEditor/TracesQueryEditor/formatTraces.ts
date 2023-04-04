import { DataFrameDTO, DataQueryResponse, FieldType, MutableDataFrame } from '@grafana/data';

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
