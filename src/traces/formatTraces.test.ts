import { ArrayVector } from '@grafana/data';
import { createListTracesDataFrame, createTraceDataFrame, TraceListResponse } from './formatTraces';
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
      const type = 'type';

      const { data, key } = createListTracesDataFrame(targets, { responses }, uid, name, type);

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
  describe('createTraceDataFrame', () => {
    it('should return in the data frame the fields needed for trace view', () => {
      const targets = [{ refId: 'A' }];
      const traceDataFrameResult = createTraceDataFrame(targets, {
        responses: [{ hits: { hits: spanListResponse as OpenSearchSpan[] } }],
      });
      expect(traceDataFrameResult.data.length).toEqual(1);
      expect(traceDataFrameResult.key).toEqual('A');
      const singleDataFrame = traceDataFrameResult.data[0];
      expect(singleDataFrame.meta.preferredVisualisationType).toEqual('trace');
      expect(singleDataFrame.fields.find(field => field.name === 'traceID').values).toEqual(
        new ArrayVector(['0000000000000000213ce26adf2b30d0', '0000000000000000213ce26adf2b30d0'])
      );
      expect(singleDataFrame.fields.find(field => field.name === 'duration').values).toEqual(
        new ArrayVector([227061000 * 0.000001, 525654000 * 0.000001])
      );
      expect(singleDataFrame.fields.find(field => field.name === 'serviceName').values).toEqual(
        new ArrayVector(['driver', 'mysql'])
      );
      expect(singleDataFrame.fields.find(field => field.name === 'parentSpanID').values).toEqual(
        new ArrayVector(['00ce90d301af791e', '008cf73f4305cbf6'])
      );
      expect(singleDataFrame.fields.find(field => field.name === 'spanID').values).toEqual(
        new ArrayVector(['3a5ea3d834fc316d', '153f525e711e84a8'])
      );
      expect(singleDataFrame.fields.find(field => field.name === 'operationName').values).toEqual(
        new ArrayVector(['/driver.DriverService/FindNearest', 'SQL SELECT'])
      );
      expect(singleDataFrame.fields.find(field => field.name === 'startTime').values).toEqual(
        new ArrayVector([
          new Date('2023-04-11T11:14:31.243838Z').getTime(),
          new Date('2023-04-11T11:14:30.717151Z').getTime(),
        ])
      );
      // cSpell:disable
      expect(singleDataFrame.fields.find(field => field.name === 'serviceTags').values).toEqual(
        new ArrayVector([
          [
            { key: 'client-uuid', value: '1e1a9d5a8c9212c5' },
            { key: 'ip', value: '172.18.0.4' },
            { key: 'host@name', value: '431dd3506ada' },
            { key: 'opencensus@exporterversion', value: 'Jaeger-Go-2.30.0' },
            { key: 'service@name', value: 'frontend' },
          ],
          [
            { key: 'client-uuid', value: '3247c6c5bc03502a' },
            { key: 'ip', value: '172.18.0.4' },
            { key: 'host@name', value: '431dd3506ada' },
            { key: 'opencensus@exporterversion', value: 'Jaeger-Go-2.30.0' },
            { key: 'service@name', value: 'mysql' },
          ],
        ])
      );
      expect(singleDataFrame.fields.find(field => field.name === 'tags').values).toEqual(
        new ArrayVector([
          [
            { key: 'http@method', value: 'GET' },
            { key: 'http@url', value: '0.0.0.0:8083' },
            { key: 'net/http@reused', value: true },
            { key: 'component', value: 'net/http' },
            { key: 'net/http@was_idle', value: true },
            { key: 'http@status_code', value: 200 },
            { key: 'error', value: true },
          ],
          [
            { key: 'peer@service', value: 'mysql' },
            { key: 'sql@query', value: 'SELECT * FROM customer WHERE customer_id=567' },
            { key: 'request', value: '9859-4' },
            { key: 'error', value: false },
          ],
        ])
      );
      /* cSpell:enable */
      expect(singleDataFrame.fields.find(field => field.name === 'stackTraces').values).toEqual(
        new ArrayVector([
          [
            'Retrying GetDriver after error: redis timeout',
            'Retrying GetDriver after error: redis timeout',
            'Retrying GetDriver after error: redis timeout',
          ],
          undefined,
        ])
      );
      expect(singleDataFrame.fields.find(field => field.name === 'logs').values).toEqual(
        new ArrayVector([
          [
            {
              timestamp: new Date('2023-04-11T11:14:31.243861Z').getTime(),
              fields: [{ key: 'name', value: 'Searching for nearby drivers' }],
            },
            {
              timestamp: new Date('2023-04-11T11:14:31.293467Z').getTime(),
              fields: [{ key: 'name', value: 'Retrying GetDriver after error' }],
            },
            {
              timestamp: new Date('2023-04-11T11:14:31.368222Z').getTime(),
              fields: [{ key: 'name', value: 'Retrying GetDriver after error' }],
            },
            {
              timestamp: new Date('2023-04-11T11:14:31.444387Z').getTime(),
              fields: [{ key: 'name', value: 'Retrying GetDriver after error' }],
            },
            {
              timestamp: new Date('2023-04-11T11:14:31.470844Z').getTime(),
              fields: [{ key: 'name', value: 'Search successful' }],
            },
            {
              timestamp: new Date('2023-04-11T11:14:31.571795Z').getTime(),
              fields: [{ key: 'name', value: 'GetConn' }],
            },
            {
              timestamp: new Date('2023-04-11T11:14:31.571799Z').getTime(),
              fields: [{ key: 'name', value: 'GotConn' }],
            },
          ],
          [
            {
              timestamp: new Date('2023-04-11T11:14:30.717163Z').getTime(),
              fields: [{ key: 'name', value: 'Waiting for lock behind 1 transactions' }],
            },
            {
              timestamp: new Date('2023-04-11T11:14:30.941138Z').getTime(),
              fields: [{ key: 'name', value: 'Acquired lock with 0 transactions waiting behind' }],
            },
          ],
        ])
      );
    });
  });
});
