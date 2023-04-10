import { ArrayVector, FieldType } from '@grafana/data';
import { createListTracesDataFrame, TraceListResponse } from './formatTraces';

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
});
