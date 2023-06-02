import {
  DataFrame,
  DataFrameView,
  Field,
  FieldCache,
  FieldType,
  KeyValue,
  MutableDataFrame,
  toUtc,
} from '@grafana/data';
import { OpenSearchResponse } from '../OpenSearchResponse';
import flatten from '../dependencies/flatten';
import { OpenSearchDataQueryResponse, OpenSearchQuery, QueryType } from '../types';

function getTimeField(frame: DataFrame): Field {
  const field = frame.fields[0];
  if (field.type !== FieldType.time) {
    throw new Error('first field should be the time-field');
  }
  return field;
}

function getValueField(frame: DataFrame): Field {
  const field = frame.fields[1];
  if (field.type !== FieldType.number) {
    throw new Error('second field should be the number-field');
  }
  return field;
}

describe('OpenSearchResponse', () => {
  let targets: OpenSearchQuery[];
  let response: any;
  let result: OpenSearchDataQueryResponse;

  describe('refId matching', () => {
    // We default to the old table structure to ensure backward compatibility,
    // therefore we only process responses as DataFrames when there's at least one
    // raw_data (new) query type.
    // We should test if refId gets populated wether there's such type of query or not
    interface MockedQueryData {
      target: OpenSearchQuery;
      response: any;
    }

    const countQuery: MockedQueryData = {
      target: {
        refId: 'COUNT_GROUPBY_DATE_HISTOGRAM',
        metrics: [{ type: 'count', id: 'c_1' }],
        bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: 'c_2' }],
      } as OpenSearchQuery,
      response: {
        aggregations: {
          c_2: {
            buckets: [
              {
                doc_count: 10,
                key: 1000,
              },
            ],
          },
        },
      },
    };

    const countGroupByHistogramQuery: MockedQueryData = {
      target: {
        refId: 'COUNT_GROUPBY_HISTOGRAM',
        metrics: [{ type: 'count', id: 'h_3' }],
        bucketAggs: [{ type: 'histogram', field: 'bytes', id: 'h_4' }],
      },
      response: {
        aggregations: {
          h_4: {
            buckets: [{ doc_count: 1, key: 1000 }],
          },
        },
      },
    };

    const rawDocumentQuery: MockedQueryData = {
      target: {
        refId: 'RAW_DOC',
        metrics: [{ type: 'raw_document', id: 'r_5' }],
        bucketAggs: [],
      },
      response: {
        hits: {
          total: 2,
          hits: [
            {
              _id: '5',
              _type: 'type',
              _index: 'index',
              _source: { sourceProp: 'asd' },
              fields: { fieldProp: 'field' },
            },
            {
              _source: { sourceProp: 'asd2' },
              fields: { fieldProp: 'field2' },
            },
          ],
        },
      },
    };

    const percentilesQuery: MockedQueryData = {
      target: {
        refId: 'PERCENTILE',
        metrics: [{ type: 'percentiles', settings: { percents: ['75', '90'] }, id: 'p_1' }],
        bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: 'p_3' }],
      },
      response: {
        aggregations: {
          p_3: {
            buckets: [
              {
                p_1: { values: { '75': 3.3, '90': 5.5 } },
                doc_count: 10,
                key: 1000,
              },
              {
                p_1: { values: { '75': 2.3, '90': 4.5 } },
                doc_count: 15,
                key: 2000,
              },
            ],
          },
        },
      },
    };

    const extendedStatsQuery: MockedQueryData = {
      target: {
        refId: 'EXTENDEDSTATS',
        metrics: [
          {
            type: 'extended_stats',
            meta: { max: true, std_deviation_bounds_upper: true },
            id: 'e_1',
          },
        ],
        bucketAggs: [
          { type: 'terms', field: 'host', id: 'e_3' },
          { type: 'date_histogram', id: 'e_4' },
        ],
      },
      response: {
        aggregations: {
          e_3: {
            buckets: [
              {
                key: 'server1',
                e_4: {
                  buckets: [
                    {
                      e_1: {
                        max: 10.2,
                        min: 5.5,
                        std_deviation_bounds: { upper: 3, lower: -2 },
                      },
                      doc_count: 10,
                      key: 1000,
                    },
                  ],
                },
              },
              {
                key: 'server2',
                e_4: {
                  buckets: [
                    {
                      e_1: {
                        max: 10.2,
                        min: 5.5,
                        std_deviation_bounds: { upper: 3, lower: -2 },
                      },
                      doc_count: 10,
                      key: 1000,
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    };

    const commonTargets = [
      { ...countQuery.target },
      { ...countGroupByHistogramQuery.target },
      { ...rawDocumentQuery.target },
      { ...percentilesQuery.target },
      { ...extendedStatsQuery.target },
    ];

    const commonResponses = [
      { ...countQuery.response },
      { ...countGroupByHistogramQuery.response },
      { ...rawDocumentQuery.response },
      { ...percentilesQuery.response },
      { ...extendedStatsQuery.response },
    ];

    describe('When processing responses as DataFrames (raw_data query present)', () => {
      beforeEach(() => {
        targets = [
          ...commonTargets,
          // Raw Data Query
          {
            refId: 'D',
            metrics: [{ type: 'raw_data', id: '6' }],
            bucketAggs: [],
          },
        ];

        response = {
          responses: [
            ...commonResponses,
            // Raw Data Query
            {
              hits: {
                total: {
                  relation: 'eq',
                  value: 1,
                },
                hits: [
                  {
                    _id: '6',
                    _type: '_doc',
                    _index: 'index',
                    _source: { sourceProp: 'asd' },
                  },
                ],
              },
            },
          ],
        };

        result = new OpenSearchResponse(targets, response).getTimeSeries();
      });

      it('should add the correct refId to each returned series', () => {
        expect(result.data[0].refId).toBe(countQuery.target.refId);

        expect(result.data[1].refId).toBe(countGroupByHistogramQuery.target.refId);

        expect(result.data[2].refId).toBe(rawDocumentQuery.target.refId);

        expect(result.data[3].refId).toBe(percentilesQuery.target.refId);
        expect(result.data[4].refId).toBe(percentilesQuery.target.refId);

        expect(result.data[5].refId).toBe(extendedStatsQuery.target.refId);

        // Raw Data query
        expect(result.data[result.data.length - 1].refId).toBe('D');
      });
    });

    describe('When NOT processing responses as DataFrames (raw_data query NOT present)', () => {
      beforeEach(() => {
        targets = [...commonTargets];

        response = {
          responses: [...commonResponses],
        };

        result = new OpenSearchResponse(targets, response).getTimeSeries();
      });

      it('should add the correct refId to each returned series', () => {
        expect(result.data[0].refId).toBe(countQuery.target.refId);

        expect(result.data[1].refId).toBe(countGroupByHistogramQuery.target.refId);
        expect(result.data[2].refId).toBe(rawDocumentQuery.target.refId);

        expect(result.data[3].refId).toBe(percentilesQuery.target.refId);
        expect(result.data[4].refId).toBe(percentilesQuery.target.refId);

        expect(result.data[5].refId).toBe(extendedStatsQuery.target.refId);
      });
    });
  });

  describe('simple query and count', () => {
    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'count', id: '1' }],
          bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    doc_count: 10,
                    key: 1000,
                  },
                  {
                    doc_count: 15,
                    key: 2000,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should return 1 series', () => {
      const frame1 = result.data[0];
      expect(result.data.length).toBe(1);
      expect(frame1.name).toBe('Count');
      expect(frame1.fields.length).toBe(2);
      expect(getTimeField(frame1).values.get(0)).toBe(1000);
      expect(getValueField(frame1).values.get(0)).toBe(10);
      expect(getTimeField(frame1).values.get(1)).toBe(2000);
      expect(getValueField(frame1).values.get(1)).toBe(15);
    });
  });

  describe('simple query count & avg aggregation', () => {
    let result: OpenSearchDataQueryResponse;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { type: 'count', id: '1' },
            { type: 'avg', field: 'value', id: '2' },
          ],
          bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '3': {
                buckets: [
                  {
                    '2': { value: 88 },
                    doc_count: 10,
                    key: 1000,
                  },
                  {
                    '2': { value: 99 },
                    doc_count: 15,
                    key: 2000,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should return 2 series', () => {
      expect(result.data.length).toBe(2);
      const frame1 = result.data[0];
      const frame2 = result.data[1];
      expect(frame1.length).toBe(2);
      expect(getValueField(frame1).values.get(0)).toBe(10);
      expect(getTimeField(frame1).values.get(0)).toBe(1000);

      expect(frame2.name).toBe('Average value');
      expect(getValueField(frame2).values.toArray()).toStrictEqual([88, 99]);
    });
  });

  describe('single group by query one metric', () => {
    let result: OpenSearchDataQueryResponse;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'count', id: '1' }],
          bucketAggs: [
            { type: 'terms', field: 'host', id: '2' },
            { type: 'date_histogram', field: '@timestamp', id: '3' },
          ],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    '3': {
                      buckets: [
                        { doc_count: 1, key: 1000 },
                        { doc_count: 3, key: 2000 },
                      ],
                    },
                    doc_count: 4,
                    key: 'server1',
                  },
                  {
                    '3': {
                      buckets: [
                        { doc_count: 2, key: 1000 },
                        { doc_count: 8, key: 2000 },
                      ],
                    },
                    doc_count: 10,
                    key: 'server2',
                  },
                ],
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should return 2 series', () => {
      expect(result.data.length).toBe(2);

      const frame1 = result.data[0];
      expect(frame1.name).toBe('server1');
      expect(frame1.fields.length).toBe(2);
      expect(getTimeField(frame1).values.toArray()).toStrictEqual([1000, 2000]);
      expect(getValueField(frame1).values.toArray()).toStrictEqual([1, 3]);

      const frame2 = result.data[1];
      expect(frame2.name).toBe('server2');
      expect(frame2.fields.length).toBe(2);
      expect(getTimeField(frame2).values.toArray()).toStrictEqual([1000, 2000]);
      expect(getValueField(frame2).values.toArray()).toStrictEqual([2, 8]);
    });
  });

  describe('single group by query two metrics', () => {
    let result: OpenSearchDataQueryResponse;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { type: 'count', id: '1' },
            { type: 'avg', field: '@value', id: '4' },
          ],
          bucketAggs: [
            { type: 'terms', field: 'host', id: '2' },
            { type: 'date_histogram', field: '@timestamp', id: '3' },
          ],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    '3': {
                      buckets: [
                        { '4': { value: 10 }, doc_count: 1, key: 1000 },
                        { '4': { value: 12 }, doc_count: 3, key: 2000 },
                      ],
                    },
                    doc_count: 4,
                    key: 'server1',
                  },
                  {
                    '3': {
                      buckets: [
                        { '4': { value: 20 }, doc_count: 1, key: 1000 },
                        { '4': { value: 32 }, doc_count: 3, key: 2000 },
                      ],
                    },
                    doc_count: 10,
                    key: 'server2',
                  },
                ],
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should return 2 series', () => {
      expect(result.data.length).toBe(4);
      expect(result.data[0].length).toBe(2);
      expect(result.data[0].name).toBe('server1 Count');
      expect(result.data[1].name).toBe('server1 Average @value');
      expect(result.data[2].name).toBe('server2 Count');
      expect(result.data[3].name).toBe('server2 Average @value');
    });
  });

  describe('with percentiles ', () => {
    let result: OpenSearchDataQueryResponse;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'percentiles', settings: { percents: ['75', '90'] }, id: '1', field: '@value' }],
          bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '3': {
                buckets: [
                  {
                    '1': { values: { '75': 3.3, '90': 5.5 } },
                    doc_count: 10,
                    key: 1000,
                  },
                  {
                    '1': { values: { '75': 2.3, '90': 4.5 } },
                    doc_count: 15,
                    key: 2000,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should return 2 series', () => {
      expect(result.data.length).toBe(2);
      expect(result.data[0].name).toBe('p75 @value');
      expect(result.data[1].name).toBe('p90 @value');

      const frame1 = result.data[0];
      expect(getTimeField(frame1).values.toArray()).toStrictEqual([1000, 2000]);
      expect(getValueField(frame1).values.toArray()).toStrictEqual([3.3, 2.3]);

      const frame2 = result.data[1];
      expect(getTimeField(frame2).values.toArray()).toStrictEqual([1000, 2000]);
      expect(getValueField(frame2).values.toArray()).toStrictEqual([5.5, 4.5]);
    });
  });

  describe('with extended_stats', () => {
    let result: OpenSearchDataQueryResponse;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            {
              type: 'extended_stats',
              meta: { max: true, std_deviation_bounds_upper: true },
              id: '1',
              field: '@value',
            },
          ],
          bucketAggs: [
            { type: 'terms', field: 'host', id: '3' },
            { type: 'date_histogram', id: '4' },
          ],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '3': {
                buckets: [
                  {
                    key: 'server1',
                    '4': {
                      buckets: [
                        {
                          '1': {
                            max: 10.2,
                            min: 5.5,
                            std_deviation_bounds: { upper: 3, lower: -2 },
                          },
                          doc_count: 10,
                          key: 1000,
                        },
                      ],
                    },
                  },
                  {
                    key: 'server2',
                    '4': {
                      buckets: [
                        {
                          '1': {
                            max: 10.2,
                            min: 5.5,
                            std_deviation_bounds: { upper: 3, lower: -2 },
                          },
                          doc_count: 10,
                          key: 1000,
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should return 4 series', () => {
      expect(result.data.length).toBe(4);
      expect(result.data[0].length).toBe(1);
      expect(result.data[0].name).toBe('server1 Max @value');
      expect(result.data[1].name).toBe('server1 Std Dev Upper @value');

      expect(getValueField(result.data[0]).values.get(0)).toBe(10.2);
      expect(getValueField(result.data[1]).values.get(0)).toBe(3);
    });
  });

  describe('single group by with alias pattern', () => {
    let result: OpenSearchDataQueryResponse;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'count', id: '1' }],
          alias: '{{term @host}} {{metric}} and {{not_exist}} {{@host}}',
          bucketAggs: [
            { type: 'terms', field: '@host', id: '2' },
            { type: 'date_histogram', field: '@timestamp', id: '3' },
          ],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    '3': {
                      buckets: [
                        { doc_count: 1, key: 1000 },
                        { doc_count: 3, key: 2000 },
                      ],
                    },
                    doc_count: 4,
                    key: 'server1',
                  },
                  {
                    '3': {
                      buckets: [
                        { doc_count: 2, key: 1000 },
                        { doc_count: 8, key: 2000 },
                      ],
                    },
                    doc_count: 10,
                    key: 'server2',
                  },
                  {
                    '3': {
                      buckets: [
                        { doc_count: 2, key: 1000 },
                        { doc_count: 8, key: 2000 },
                      ],
                    },
                    doc_count: 10,
                    key: 0,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should return 2 series', () => {
      expect(result.data.length).toBe(3);
      expect(result.data[0].length).toBe(2);
      expect(result.data[0].name).toBe('server1 Count and {{not_exist}} server1');
      expect(result.data[1].name).toBe('server2 Count and {{not_exist}} server2');
      expect(result.data[2].name).toBe('0 Count and {{not_exist}} 0');
    });
  });

  describe('histogram response', () => {
    let result: OpenSearchDataQueryResponse;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'count', id: '1' }],
          bucketAggs: [{ type: 'histogram', field: 'bytes', id: '3' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '3': {
                buckets: [
                  { doc_count: 1, key: 1000 },
                  { doc_count: 3, key: 2000 },
                  { doc_count: 2, key: 1000 },
                ],
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should return dataframe with byte and count', () => {
      expect(result.data[0].length).toBe(3);
      const { fields } = result.data[0];
      expect(fields.length).toBe(2);
      expect(fields[0].name).toBe('bytes');
      expect(fields[0].config).toStrictEqual({ filterable: true });
      expect(fields[1].name).toBe('Count');
      expect(fields[1].config).toStrictEqual({});
    });
  });

  describe('with two filters agg', () => {
    let result: OpenSearchDataQueryResponse;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'count', id: '1' }],
          bucketAggs: [
            {
              id: '2',
              type: 'filters',
              settings: {
                filters: [
                  { query: '@metric:cpu', label: '' },
                  { query: '@metric:logins.count', label: '' },
                ],
              },
            },
            { type: 'date_histogram', field: '@timestamp', id: '3' },
          ],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: {
                  '@metric:cpu': {
                    '3': {
                      buckets: [
                        { doc_count: 1, key: 1000 },
                        { doc_count: 3, key: 2000 },
                      ],
                    },
                  },
                  '@metric:logins.count': {
                    '3': {
                      buckets: [
                        { doc_count: 2, key: 1000 },
                        { doc_count: 8, key: 2000 },
                      ],
                    },
                  },
                },
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should return 2 series', () => {
      expect(result.data[0].length).toBe(2);
      expect(result.data[0].name).toBe('@metric:cpu');
      expect(result.data[1].name).toBe('@metric:logins.count');
    });
  });

  describe('with dropfirst and last aggregation', () => {
    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { type: 'avg', id: '1', field: '@value' },
            { type: 'count', id: '3' },
          ],
          bucketAggs: [
            {
              id: '2',
              type: 'date_histogram',
              field: 'host',
              settings: { trimEdges: '1' },
            },
          ],
        },
      ];

      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    '1': { value: 1000 },
                    key: 1,
                    doc_count: 369,
                  },
                  {
                    '1': { value: 2000 },
                    key: 2,
                    doc_count: 200,
                  },
                  {
                    '1': { value: 2000 },
                    key: 3,
                    doc_count: 200,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should remove first and last value', () => {
      expect(result.data.length).toBe(2);
      expect(result.data[0].length).toBe(1);
    });
  });

  describe('No group by time', () => {
    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { type: 'avg', id: '1', field: '@value' },
            { type: 'count', id: '3' },
          ],
          bucketAggs: [{ id: '2', type: 'terms', field: 'host' }],
        },
      ];

      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    '1': { value: 1000 },
                    key: 'server-1',
                    doc_count: 369,
                  },
                  {
                    '1': { value: 2000 },
                    key: 'server-2',
                    doc_count: 200,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should return data frame', () => {
      expect(result.data[0].length).toBe(2);
      expect(result.data[0].fields.length).toBe(3);
      const field1 = result.data[0].fields[0];
      const field2 = result.data[0].fields[1];
      const field3 = result.data[0].fields[2];

      expect(field1.values.toArray()).toStrictEqual(['server-1', 'server-2']);
      expect(field2.values.toArray()).toStrictEqual([1000, 2000]);
      expect(field3.values.toArray()).toStrictEqual([369, 200]);
    });
  });

  describe('No group by time with percentiles ', () => {
    let result: OpenSearchDataQueryResponse;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'percentiles', field: 'value', settings: { percents: ['75', '90'] }, id: '1' }],
          bucketAggs: [{ type: 'terms', field: 'id', id: '3' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '3': {
                buckets: [
                  {
                    '1': { values: { '75': 3.3, '90': 5.5 } },
                    doc_count: 10,
                    key: 'id1',
                  },
                  {
                    '1': { values: { '75': 2.3, '90': 4.5 } },
                    doc_count: 15,
                    key: 'id2',
                  },
                ],
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should return data frame', () => {
      expect(result.data.length).toBe(1);
      expect(result.data[0].length).toBe(2);
      const field1 = result.data[0].fields[0];
      const field2 = result.data[0].fields[1];
      const field3 = result.data[0].fields[2];
      expect(field1.name).toBe('id');
      expect(field2.name).toBe('p75 value');
      expect(field3.name).toBe('p90 value');

      expect(field1.values.toArray()).toStrictEqual(['id1', 'id2']);
      expect(field2.values.toArray()).toStrictEqual([3.3, 2.3]);
      expect(field3.values.toArray()).toStrictEqual([5.5, 4.5]);
    });
  });

  describe('Multiple metrics of same type', () => {
    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { type: 'avg', id: '1', field: 'test' },
            { type: 'avg', id: '2', field: 'test2' },
          ],
          bucketAggs: [{ id: '2', type: 'terms', field: 'host' }],
        },
      ];

      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    '1': { value: 1000 },
                    '2': { value: 3000 },
                    key: 'server-1',
                    doc_count: 369,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should include field in metric name', () => {
      expect(result.data[0].length).toBe(1);
      expect(result.data[0].fields.length).toBe(3);
      expect(result.data[0].fields[0].values.toArray()).toStrictEqual(['server-1']);
      expect(result.data[0].fields[1].values.toArray()).toStrictEqual([1000]);
      expect(result.data[0].fields[2].values.toArray()).toStrictEqual([3000]);
    });
  });

  describe('Raw documents query', () => {
    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'raw_document', id: '1' }],
          bucketAggs: [],
        },
      ];
      response = {
        responses: [
          {
            hits: {
              total: 100,
              hits: [
                {
                  _id: '1',
                  _type: 'type',
                  _index: 'index',
                  _source: { sourceProp: 'asd' },
                  fields: { fieldProp: 'field' },
                },
                {
                  _source: { sourceProp: 'asd2' },
                  fields: { fieldProp: 'field2' },
                },
              ],
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should return raw_document formatted data', () => {
      const frame = result.data[0];
      const { fields } = frame;
      expect(fields.length).toBe(1);
      const field = fields[0];
      expect(field.type === FieldType.other);
      const values = field.values.toArray();
      expect(values.length).toBe(2);
      expect(values[0].sourceProp).toBe('asd');
      expect(values[0].fieldProp).toBe('field');
    });
  });

  describe('with bucket_script ', () => {
    let result: OpenSearchDataQueryResponse;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { id: '1', type: 'sum', field: '@value' },
            { id: '3', type: 'max', field: '@value' },
            {
              id: '4',
              pipelineVariables: [
                { name: 'var1', pipelineAgg: '1' },
                { name: 'var2', pipelineAgg: '3' },
              ],
              settings: { script: 'params.var1 * params.var2' },
              type: 'bucket_script',
            },
          ],
          bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    1: { value: 2 },
                    3: { value: 3 },
                    4: { value: 6 },
                    doc_count: 60,
                    key: 1000,
                  },
                  {
                    1: { value: 3 },
                    3: { value: 4 },
                    4: { value: 12 },
                    doc_count: 60,
                    key: 2000,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });
    it('should return 3 series', () => {
      expect(result.data.length).toBe(3);
      expect(result.data[0].length).toBe(2);
      expect(result.data[0].name).toBe('Sum @value');
      expect(result.data[1].name).toBe('Max @value');
      expect(result.data[2].name).toBe('Sum @value * Max @value');
      expect(getValueField(result.data[0]).values.get(0)).toBe(2);
      expect(getValueField(result.data[1]).values.get(0)).toBe(3);
      expect(getValueField(result.data[2]).values.get(0)).toBe(6);
      expect(getValueField(result.data[0]).values.get(1)).toBe(3);
      expect(getValueField(result.data[1]).values.get(1)).toBe(4);
      expect(getValueField(result.data[2]).values.get(1)).toBe(12);
    });
  });

  describe('terms with bucket_script and two scripts', () => {
    let result: OpenSearchDataQueryResponse;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { id: '1', type: 'sum', field: '@value' },
            { id: '3', type: 'max', field: '@value' },
            {
              id: '4',
              pipelineVariables: [
                { name: 'var1', pipelineAgg: '1' },
                { name: 'var2', pipelineAgg: '3' },
              ],
              settings: { script: 'params.var1 * params.var2' },
              type: 'bucket_script',
            },
            {
              id: '5',
              pipelineVariables: [
                { name: 'var1', pipelineAgg: '1' },
                { name: 'var2', pipelineAgg: '3' },
              ],
              settings: { script: 'params.var1 * params.var2 * 4' },
              type: 'bucket_script',
            },
          ],
          bucketAggs: [{ type: 'terms', field: '@timestamp', id: '2' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    1: { value: 2 },
                    3: { value: 3 },
                    4: { value: 6 },
                    5: { value: 24 },
                    doc_count: 60,
                    key: 1000,
                  },
                  {
                    1: { value: 3 },
                    3: { value: 4 },
                    4: { value: 12 },
                    5: { value: 48 },
                    doc_count: 60,
                    key: 2000,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should return 2 rows with 5 columns', () => {
      const frame = result.data[0];
      expect(frame.length).toBe(2);
      const { fields } = frame;
      expect(fields.length).toBe(5);
      expect(fields[0].values.toArray()).toStrictEqual([1000, 2000]);
      expect(fields[1].values.toArray()).toStrictEqual([2, 3]);
      expect(fields[2].values.toArray()).toStrictEqual([3, 4]);
      expect(fields[3].values.toArray()).toStrictEqual([6, 12]);
      expect(fields[4].values.toArray()).toStrictEqual([24, 48]);
    });
  });

  describe('Raw Data Query', () => {
    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'raw_data', id: '1' }],
          bucketAggs: [],
        },
      ];

      response = {
        responses: [
          {
            hits: {
              total: {
                relation: 'eq',
                value: 1,
              },
              hits: [
                {
                  _id: '1',
                  _type: '_doc',
                  _index: 'index',
                  _source: { sourceProp: 'asd' },
                },
              ],
            },
          },
        ],
      };

      result = new OpenSearchResponse(targets, response).getTimeSeries();
    });

    it('should create dataframes with filterable fields', () => {
      for (const field of result.data[0].fields) {
        expect(field.config.filterable).toBe(true);
      }
    });
  });

  describe('simple logs query and count', () => {
    const targets: any = [
      {
        refId: 'A',
        metrics: [{ type: 'count', id: '1' }],
        bucketAggs: [{ type: 'date_histogram', settings: { interval: 'auto' }, id: '2' }],
        context: 'explore',
        interval: '10s',
        isLogsQuery: true,
        key: 'Q-1561369883389-0.7611823271062786-0',
        liveStreaming: false,
        maxDataPoints: 1620,
        query: '',
        timeField: '@timestamp',
      },
    ];
    const response = {
      responses: [
        {
          aggregations: {
            '2': {
              buckets: [
                {
                  doc_count: 10,
                  key: 1000,
                },
                {
                  doc_count: 15,
                  key: 2000,
                },
              ],
            },
          },
          hits: {
            hits: [
              {
                _id: 'iAmID',
                _type: '_doc',
                _index: 'mock-index',
                _source: {
                  '@timestamp': '2019-06-24T09:51:19.765Z',
                  host: 'iAmAHost',
                  message: 'hello, i am a message',
                  level: 'debug',
                  fields: {
                    lvl: 'debug',
                  },
                },
              },
              {
                _id: 'iAmAnotherID',
                _type: '_doc',
                _index: 'mock-index',
                _source: {
                  '@timestamp': '2019-06-24T09:52:19.765Z',
                  host: 'iAmAnotherHost',
                  message: 'hello, i am also message',
                  level: 'error',
                  fields: {
                    lvl: 'info',
                  },
                },
              },
            ],
          },
        },
      ],
    };

    it('should return histogram aggregation and documents', () => {
      const result = new OpenSearchResponse(targets, response).getLogs();
      expect(result.data.length).toBe(2);
      const logResults = result.data[0] as MutableDataFrame;
      const fields = logResults.fields.map(f => {
        return {
          name: f.name,
          type: f.type,
        };
      });

      expect(fields).toContainEqual({ name: '@timestamp', type: 'time' });
      expect(fields).toContainEqual({ name: 'host', type: 'string' });
      expect(fields).toContainEqual({ name: 'message', type: 'string' });

      let rows = new DataFrameView(logResults);
      for (let i = 0; i < rows.length; i++) {
        const r = rows.get(i);
        expect(r._id).toEqual(response.responses[0].hits.hits[i]._id);
        expect(r._type).toEqual(response.responses[0].hits.hits[i]._type);
        expect(r._index).toEqual(response.responses[0].hits.hits[i]._index);
        expect(r._source).toEqual(
          flatten(
            response.responses[0].hits.hits[i]._source,
            (null as unknown) as { delimiter?: any; maxDepth?: any; safe?: any }
          )
        );
      }

      // Make a map from the histogram results
      const hist: KeyValue<number> = {};
      const histogramResults = new MutableDataFrame(result.data[1]);
      rows = new DataFrameView(histogramResults);

      for (let i = 0; i < rows.length; i++) {
        const row = rows.get(i);
        hist[row.Time] = row.Value;
      }

      response.responses[0].aggregations['2'].buckets.forEach((bucket: any) => {
        expect(hist[bucket.key]).toEqual(bucket.doc_count);
      });
    });

    it('should map levels field', () => {
      const result = new OpenSearchResponse(targets, response).getLogs(undefined, 'level');
      const fieldCache = new FieldCache(result.data[0]);
      const field = fieldCache.getFieldByName('level');
      expect(field?.values.toArray()).toEqual(['debug', 'error']);
    });

    it('should re map levels field to new field', () => {
      const result = new OpenSearchResponse(targets, response).getLogs(undefined, 'fields.lvl');
      const fieldCache = new FieldCache(result.data[0]);
      const field = fieldCache.getFieldByName('level');
      expect(field?.values.toArray()).toEqual(['debug', 'info']);
    });
  });

  describe('PPL log query response', () => {
    const targets: any = [
      {
        refId: 'A',
        isLogsQuery: true,
        queryType: QueryType.PPL,
        timeField: 'timestamp',
        format: 'table',
        query: 'source=sample_data_logs',
      },
    ];
    const response = {
      datarows: [
        ['test-data1', 'message1', { coordinates: { lat: 5, lon: 10 } }],
        ['test-data2', 'message2', { coordinates: { lat: 6, lon: 11 } }],
        ['test-data3', 'message3', { coordinates: { lat: 7, lon: 12 } }],
      ],
      schema: [
        { name: 'data', type: 'string' },
        { name: 'message', type: 'string' },
        { name: 'geo', type: 'struct' },
      ],
    };
    const targetType = QueryType.PPL;
    it('should return all data', () => {
      const result = new OpenSearchResponse(targets, response, targetType).getLogs();
      expect(result.data.length).toBe(1);
      const logResults = result.data[0] as MutableDataFrame;
      const fields = logResults.fields.map(f => {
        return {
          name: f.name,
          type: f.type,
        };
      });
      expect(fields).toContainEqual({ name: 'data', type: 'string' });
      expect(fields).toContainEqual({ name: 'message', type: 'string' });
      expect(fields).toContainEqual({ name: 'geo.coordinates.lat', type: 'string' });
      expect(fields).toContainEqual({ name: 'geo.coordinates.lon', type: 'string' });

      let rows = new DataFrameView(logResults);
      expect(rows.length).toBe(3);
      for (let i = 0; i < rows.length; i++) {
        const r = rows.get(i);
        expect(r.data).toEqual(response.datarows[i][0]);
        expect(r.message).toEqual(response.datarows[i][1]);
      }
    });
  });

  describe('PPL table query response', () => {
    const targets: any = [
      {
        refId: 'A',
        context: 'explore',
        interval: '10s',
        isLogsQuery: false,
        query: 'source=sample_data | stats count(test) by timestamp',
        queryType: QueryType.PPL,
        timeField: 'timestamp',
        format: 'table',
      },
    ];
    const response = {
      datarows: [
        [5, '2020-11-01 00:39:02.912'],
        [1, '2020-11-01 03:26:21.326'],
        [4, '2020-11-01 03:34:43.399'],
      ],
      schema: [
        { name: 'test', type: 'string' },
        { name: 'timestamp', type: 'timestamp' },
      ],
    };
    const targetType = QueryType.PPL;

    it('should create dataframes with filterable fields', () => {
      const result = new OpenSearchResponse(targets, response, targetType).getTable();
      for (const field of result.data[0].fields) {
        expect(field.config.filterable).toBe(true);
      }
    });
    it('should return all data', () => {
      const result = new OpenSearchResponse(targets, response, targetType).getTable();
      expect(result.data.length).toBe(1);
      const logResults = result.data[0] as MutableDataFrame;
      const fields = logResults.fields.map(f => {
        return {
          name: f.name,
          type: f.type,
        };
      });
      expect(fields).toEqual([
        { name: 'test', type: 'string' },
        { name: 'timestamp', type: 'string' },
      ]);

      let rows = new DataFrameView(logResults);
      expect(rows.length).toBe(3);
      for (let i = 0; i < rows.length; i++) {
        const r = rows.get(i);
        expect(r.test).toEqual(response.datarows[i][0]);
        expect(r.timestamp).toEqual(
          toUtc(response.datarows[i][1])
            .local()
            .format('YYYY-MM-DD HH:mm:ss.SSS')
        );
      }
    });
  });

  describe('PPL time series query response', () => {
    const targets: any = [
      {
        refId: 'A',
        context: 'explore',
        interval: '10s',
        isLogsQuery: true,
        query: 'source=sample_data | stats count(test) by timestamp',
        queryType: QueryType.PPL,
        timeField: 'timestamp',
        format: 'time_series',
      },
    ];
    const targetType = QueryType.PPL;

    const response = {
      datarows: [
        [5, '2020-11-01 00:39:02.912Z'],
        [1, '2020-11-01 03:26:21.326Z'],
        [4, '2020-11-01 03:34:43.399Z'],
      ],
      schema: [
        { name: 'test', type: 'int' },
        { name: 'timeName', type: 'timestamp' },
      ],
    };
    it('should return data frames', () => {
      const result = new OpenSearchResponse(targets, response, targetType).getTimeSeries();
      expect(result.data.length).toBe(1);
      const frame = result.data[0];
      expect(getTimeField(frame).values.toArray()).toStrictEqual([1604191142000, 1604201181000, 1604201683000]);
      expect(getValueField(frame).values.toArray()).toStrictEqual([5, 1, 4]);
    });

    const response2 = {
      datarows: [
        ['2020-11-01 07Z', 5],
        ['2020-11-02 07Z', 1],
        ['2020-11-03 07Z', 4],
      ],
      schema: [
        { name: 'timeName', type: 'date' },
        { name: 'test', type: 'int' },
      ],
    };
    it('should return data frames', () => {
      const result = new OpenSearchResponse(targets, response2, targetType).getTimeSeries();
      expect(result.data.length).toBe(1);
      const frame = result.data[0];
      expect(getTimeField(frame).values.toArray()).toStrictEqual([1604214000000, 1604300400000, 1604386800000]);
      expect(getValueField(frame).values.toArray()).toStrictEqual([5, 1, 4]);
    });

    const response3 = {
      datarows: [],
      schema: [],
    };
    it('should return no data', () => {
      const result = new OpenSearchResponse(targets, response3, targetType).getTimeSeries();
      expect(result.data.length).toBe(0);
    });
  });

  describe('Invalid PPL time series query response', () => {
    const targets: any = [
      {
        refId: 'A',
        isLogsQuery: true,
        query: 'source=sample_data | stats count(test) by data',
        queryType: QueryType.PPL,
        timeField: 'timestamp',
        format: 'time_series',
      },
    ];
    const targetType = QueryType.PPL;

    const response1 = {
      datarows: [
        [5, '5000'],
        [1, '1000'],
        [4, '4000'],
      ],
      schema: [
        { name: 'test', type: 'int' },
        { name: 'data', type: 'string' },
      ],
    };
    it('should return invalid query error due to no timestamp', () => {
      expect(() => new OpenSearchResponse(targets, response1, targetType).getTimeSeries()).toThrowError(
        'Invalid time series query'
      );
    });

    const response2 = {
      datarows: [
        ['1', '2020-11-01 00:39:02.912Z'],
        ['2', '2020-11-01 03:26:21.326Z'],
        ['3', '2020-11-01 03:34:43.399Z'],
      ],
      schema: [
        { name: 'data', type: 'string' },
        { name: 'time', type: 'timestamp' },
      ],
    };
    it('should return invalid query error due to no numerical column', () => {
      expect(() => new OpenSearchResponse(targets, response2, targetType).getTimeSeries()).toThrowError(
        'Invalid time series query'
      );
    });
  });
});
