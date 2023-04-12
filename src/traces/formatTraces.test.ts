import { ArrayVector } from '@grafana/data';
import {
  createListTracesDataFrame,
  createTraceDataFrame,
  TraceListResponse,
  transformTraceResponse,
} from './formatTraces';
import { spanListResponse } from '../__mocks__/openSearchTraceMock';
import { OpenSearchSpan } from '../types';

describe('FormatTraces', () => {
  describe('#createListTracesDataFrame', () => {
    it('returns a dataframe for a list of traces', () => {
      const targets = [
        {
          refId: 'refId',
        },
      ];
      const responses: TraceListResponse[] = [
        {
          aggregations: {
            traces: {
              buckets: [
                {
                  key: 'firstTrace',
                  trace_group: { buckets: [{ key: 'HTTP Get' }] },
                  latency: { value: 10 },
                  error_count: { doc_count: 0 },
                  last_updated: { value: 'yesterday' },
                },
                {
                  key: 'secondTrace',
                  trace_group: { buckets: [{ key: 'HTTP Post' }] },
                  latency: { value: 12 },
                  error_count: { doc_count: 0 },
                  last_updated: { value: '2 days before yesterday' },
                },
              ],
            },
          },
        },
      ];
      const uid = 'uid';
      const name = 'name';

      const { data, key } = createListTracesDataFrame(targets, responses, uid, name);

      expect(data.length).toEqual(1);
      expect(key).toEqual('refId');
      const dataFrame = data[0];
      expect(dataFrame).toMatchObject({
        meta: {
          preferredVisualisationType: 'table',
        },
        fields: [
          {
            name: 'Trace Id',
            type: 'string',
            values: new ArrayVector(['firstTrace', 'secondTrace']),
            config: {
              links: [
                {
                  title: 'Trace: ${__value.raw}',
                  url: '',
                  internal: {
                    datasourceUid: 'uid',
                    datasourceName: 'name',
                    query: {
                      query: 'traceId: ${__value.raw}',
                      luceneQueryType: 'Traces',
                    },
                  },
                },
              ],
            },
          },
          {
            name: 'Trace Group',
            type: 'string',
            values: new ArrayVector(['HTTP Get', 'HTTP Post']),
            config: {},
          },
          {
            name: 'Latency (ms)',
            type: 'number',
            values: new ArrayVector([10, 12]),
            config: {},
          },
          {
            name: 'Error Count',
            type: 'number',
            values: new ArrayVector([0, 0]),
            config: {},
          },
          {
            name: 'Last Updated',
            type: 'time',
            values: new ArrayVector(['yesterday', '2 days before yesterday']),
            config: {},
          },
        ],
      });
    });
  });
  describe('transformTraceResponse', () => {
    const response = spanListResponse;
    const results = transformTraceResponse(response as OpenSearchSpan[]);
    it('should correctly transform base OpenSearch response fields into grafana trace-recognized fields', () => {
      expect(results[0].traceID).toEqual('0000000000000000213ce26adf2b30d0');
      expect(results[0].parentSpanID).toEqual('00ce90d301af791e');
      expect(results[0].spanID).toEqual('3a5ea3d834fc316d');
      expect(results[0].operationName).toEqual('/driver.DriverService/FindNearest');
      expect(results[0].startTime).toEqual(new Date('2023-04-11T11:14:31.243838Z').getTime());
      expect(results[0].duration).toEqual(227.06099999999998);
    });
    it('should correctly transform span attributes to tags', () => {
      expect(results[0].tags).toEqual([
        { key: 'http@method', value: 'GET' },
        { key: 'http@url', value: '0.0.0.0:8083' },
        { key: 'net/http@reused', value: true },
        { key: 'component', value: 'net/http' },
        { key: 'net/http@was_idle', value: true },
        { key: 'http@status_code', value: 200 },
        { key: 'error', value: true },
      ]);
    });
    it('should correctly transform resource attributes to serviceTags', () => {
      expect(results[0].serviceTags).toEqual([
        { key: 'client-uuid', value: '1e1a9d5a8c9212c5' },
        { key: 'ip', value: '172.18.0.4' },
        { key: 'host@name', value: '431dd3506ada' },
        { key: 'opencensus@exporterversion', value: 'Jaeger-Go-2.30.0' },
        { key: 'service@name', value: 'frontend' },
      ]);
    });
    it('should correctly transform events to Logs field', () => {
      expect(results[1].logs[0].timestamp).toEqual(new Date('2023-04-11T11:14:30.717163Z').getTime());
      expect(results[1].logs[0].fields[0]).toEqual({ key: 'name', value: 'Waiting for lock behind 1 transactions' });
    });
    it('should add error fields if OpenSearch span has error events', () => {
      expect(results[0].stackTraces[0]).toEqual('Retrying GetDriver after error: redis timeout');
      expect(results[0].tags.filter(tag => tag.key === 'error')).toHaveLength(1);
    });
    it('should not add error fields if OpenSearch span does not have error events', () => {
      expect(results[1].stackTraces).toBeUndefined();
      expect(results[1].tags.find(tag => tag.key === 'error')?.value).toBe(false);
    });
  });
  describe('createTraceDataFrame', () => {
    it('should return in the data frame the fields needed for trace view', () => {
      const targets = [{ refId: 'A' }];
      const traceDataFrameResult = createTraceDataFrame(targets, spanListResponse as OpenSearchSpan[]);
      expect(traceDataFrameResult.data.length).toEqual(1);
      expect(traceDataFrameResult.key).toEqual('A');
      const singleDataFrame = traceDataFrameResult.data[0];
      expect(singleDataFrame.meta.preferredVisualisationType).toEqual('trace');
      expect(singleDataFrame.fields.find(field => field.name === 'traceID')).toBeDefined();
      expect(singleDataFrame.fields.find(field => field.name === 'durationInNanos')).toBeDefined();
      expect(singleDataFrame.fields.find(field => field.name === 'serviceName')).toBeDefined();
      expect(singleDataFrame.fields.find(field => field.name === 'parentSpanID')).toBeDefined();
      expect(singleDataFrame.fields.find(field => field.name === 'spanID')).toBeDefined();
      expect(singleDataFrame.fields.find(field => field.name === 'operationName')).toBeDefined();
      expect(singleDataFrame.fields.find(field => field.name === 'startTime')).toBeDefined();
      expect(singleDataFrame.fields.find(field => field.name === 'duration')).toBeDefined();
      expect(singleDataFrame.fields.find(field => field.name === 'serviceTags')).toBeDefined();
      expect(singleDataFrame.fields.find(field => field.name === 'traceID')).toBeDefined();
      expect(singleDataFrame.fields.find(field => field.name === 'stackTraces')).toBeDefined();
      expect(singleDataFrame.fields.find(field => field.name === 'logs')).toBeDefined();
    });
  });
});
