import {
  ArrayVector,
  CoreApp,
  DataFrame,
  DataQueryRequest,
  DataSourceInstanceSettings,
  DateTime,
  dateTime,
  Field,
  FieldCache,
  MetricFindValue,
  MutableDataFrame,
  TimeRange,
  toUtc,
} from '@grafana/data';
import _ from 'lodash';
import { enhanceDataFrame, OpenSearchDatasource } from './datasource';
import { PPLFormatType } from './components/QueryEditor/PPLFormatEditor/formats';
// import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
// @ts-ignore
import { getBackendSrv } from '@grafana/runtime';
import {
  Flavor,
  LuceneQueryType,
  OpenSearchDataQueryResponse,
  OpenSearchOptions,
  OpenSearchQuery,
  QueryType,
} from './types';
import { Filters } from './components/QueryEditor/BucketAggregationsEditor/aggregations';
import { matchers } from './dependencies/matchers';
import { MetricAggregation } from 'components/QueryEditor/MetricAggregationsEditor/aggregations';
import { firstValueFrom, lastValueFrom } from 'rxjs';

expect.extend(matchers);

const OPENSEARCH_MOCK_URL = 'http://opensearch.local';

const backendSrv = {
  datasourceRequest: jest.fn(),
};

jest.mock('./tracking.ts', () => ({
  trackQuery: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: () => {
        return { name: 'elastic25' };
      },
    };
  },
  getTemplateSrv: () => ({
    replace: jest.fn(text => {
      if (text.startsWith('$')) {
        return `resolvedVariable`;
      } else {
        return text;
      }
    }),
    getAdhocFilters: jest.fn(() => []),
  }),
}));

const createTimeRange = (from: DateTime, to: DateTime): TimeRange => ({
  from,
  to,
  raw: {
    from,
    to,
  },
});

describe('OpenSearchDatasource', function(this: any) {
  const datasourceRequestMock = jest.spyOn(backendSrv, 'datasourceRequest');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  interface TestContext {
    ds: OpenSearchDatasource;
  }
  const ctx = {} as TestContext;

  function createDatasource(instanceSettings: DataSourceInstanceSettings<OpenSearchOptions>) {
    instanceSettings.jsonData = instanceSettings.jsonData || ({} as OpenSearchOptions);
    ctx.ds = new OpenSearchDatasource(instanceSettings);
  }

  describe('When testing datasource with no version', () => {
    beforeEach(() => {
      createDatasource({
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          version: null,
          flavor: null,
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);
    });

    it('should error', async () => {
      const result = await ctx.ds.testDatasource();
      expect(result.status).toBe('error');
      expect(result.message).toBe('No version set');
    });
  });

  describe('When testing datasource with index pattern', () => {
    beforeEach(() => {
      createDatasource({
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          database: '[asd-]YYYY.MM.DD',
          interval: 'Daily',
          version: '1.0.0',
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);
    });

    it('should translate index pattern to current day', () => {
      let requestOptions: any;
      datasourceRequestMock.mockImplementation(options => {
        requestOptions = options;
        return Promise.resolve({ data: {} });
      });

      ctx.ds.testDatasource();

      const today = toUtc().format('YYYY.MM.DD');
      expect(requestOptions.url).toBe(`${OPENSEARCH_MOCK_URL}/asd-${today}/_mapping`);
    });
  });

  describe('When issuing metric query with interval pattern', () => {
    let requestOptions: any, parts: any, header: any, query: any, result: any;

    beforeEach(async () => {
      createDatasource({
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          database: '[asd-]YYYY.MM.DD',
          interval: 'Daily',
          version: '1.0.0',
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);

      datasourceRequestMock.mockImplementation(options => {
        requestOptions = options;
        return Promise.resolve({
          data: {
            responses: [
              {
                aggregations: {
                  '1': {
                    buckets: [
                      {
                        doc_count: 10,
                        key: 1000,
                      },
                    ],
                  },
                },
              },
            ],
          },
        });
      });

      query = {
        range: {
          from: toUtc([2015, 4, 30, 10]),
          to: toUtc([2015, 5, 1, 10]),
        },
        targets: [
          {
            alias: '$varAlias',
            bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
            metrics: [{ type: 'count', id: '1' }],
            query: 'escape\\:test',
          },
        ],
      };

      result = await ctx.ds.query(query).toPromise();

      parts = requestOptions.data.split('\n');
      header = JSON.parse(parts[0]);
    });

    it('should translate index pattern to current day', () => {
      expect(header.index).toEqual(['asd-2015.05.30', 'asd-2015.05.31', 'asd-2015.06.01']);
    });

    it('should not resolve the variable in the original alias field in the query', () => {
      expect(query.targets[0].alias).toEqual('$varAlias');
    });

    it('should resolve the alias variable for the alias/target in the result', () => {
      expect(result.data[0].name).toEqual('resolvedVariable');
    });

    it('should json escape lucene query', () => {
      const body = JSON.parse(parts[1]);
      expect(body.query.bool.filter[1].query_string.query).toBe('escape\\:test');
    });
  });

  describe('When using sigV4 and POST request', () => {
    it('should add correct header', async () => {
      createDatasource({
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          database: 'mock-index',
          interval: 'Daily',
          version: '1.0.0',
          timeField: '@timestamp',
          serverless: true,
          sigV4Auth: true,
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);

      datasourceRequestMock.mockImplementation(options => {
        return Promise.resolve(logsResponse);
      });

      const query: DataQueryRequest<OpenSearchQuery> = {
        range: createTimeRange(toUtc([2015, 4, 30, 10]), toUtc([2019, 7, 1, 10])),
        targets: [
          {
            alias: '$varAlias',
            refId: 'A',
            bucketAggs: [{ type: 'date_histogram', settings: { interval: 'auto' }, id: '2' }],
            metrics: [{ type: 'count', id: '1' }],
            query: 'escape\\:test',
            isLogsQuery: true,
            timeField: '@timestamp',
          },
        ],
      } as DataQueryRequest<OpenSearchQuery>;

      await ctx.ds.query(query).toPromise();

      expect(datasourceRequestMock.mock.calls[0][0].headers['x-amz-content-sha256']).toBe(
        '78a015e84f933e9624c9c0154771945fbc25bf358f8d8a79562a7310b60edb1c'
      );
    });
  });

  describe('When issuing logs query with interval pattern', () => {
    async function setupDataSource(jsonData?: Partial<OpenSearchOptions>) {
      createDatasource({
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          database: 'mock-index',
          interval: 'Daily',
          version: '1.0.0',
          timeField: '@timestamp',
          ...(jsonData || {}),
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);

      datasourceRequestMock.mockImplementation(options => {
        return Promise.resolve(logsResponse);
      });

      const query: DataQueryRequest<OpenSearchQuery> = {
        range: createTimeRange(toUtc([2015, 4, 30, 10]), toUtc([2019, 7, 1, 10])),
        targets: [
          {
            alias: '$varAlias',
            refId: 'A',
            bucketAggs: [{ type: 'date_histogram', settings: { interval: 'auto' }, id: '2' }],
            metrics: [{ type: 'count', id: '1' }],
            query: 'escape\\:test',
            isLogsQuery: true,
            timeField: '@timestamp',
          },
        ],
      } as DataQueryRequest<OpenSearchQuery>;

      const queryBuilderSpy = jest.spyOn(ctx.ds.queryBuilder, 'getLogsQuery');
      const response = await ctx.ds.query(query).toPromise();
      return { queryBuilderSpy, response };
    }

    it('should call getLogsQuery()', async () => {
      const { queryBuilderSpy } = await setupDataSource();
      expect(queryBuilderSpy).toHaveBeenCalled();
    });

    it('should enhance fields with links', async () => {
      const { response } = await setupDataSource({
        dataLinks: [
          {
            field: 'host',
            url: 'http://localhost:3000/${__value.raw}',
          },
        ],
      });

      expect(response.data.length).toBe(1);
      const links = response.data[0].fields.find((field: Field) => field.name === 'host').config.links;
      expect(links.length).toBe(1);
      expect(links[0].url).toBe('http://localhost:3000/${__value.raw}');
    });
  });

  describe('When getting an error on response', () => {
    const query: DataQueryRequest<OpenSearchQuery> = {
      range: createTimeRange(toUtc([2020, 1, 1, 10]), toUtc([2020, 2, 1, 10])),
      targets: [
        {
          refId: 'A',
          alias: '$varAlias',
          bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
          metrics: [{ type: 'count', id: '1' }],
          query: 'escape\\:test',
        },
      ],
    } as DataQueryRequest<OpenSearchQuery>;

    createDatasource({
      url: OPENSEARCH_MOCK_URL,
      jsonData: {
        database: '[asd-]YYYY.MM.DD',
        interval: 'Daily',
        version: '1.0.0',
      } as OpenSearchOptions,
    } as DataSourceInstanceSettings<OpenSearchOptions>);

    it('should process it properly', async () => {
      datasourceRequestMock.mockImplementation(() => {
        return Promise.resolve({
          data: {
            took: 1,
            responses: [
              {
                error: {
                  reason: 'all shards failed',
                },
                status: 400,
              },
            ],
          },
        });
      });

      const errObject = {
        data: '{\n    "reason": "all shards failed"\n}',
        message: 'all shards failed',
      };

      try {
        await ctx.ds.query(query);
      } catch (err) {
        expect(err).toEqual(errObject);
      }
    });

    it('should properly throw an unknown error', async () => {
      datasourceRequestMock.mockImplementation(() => {
        return Promise.resolve({
          data: {
            took: 1,
            responses: [
              {
                error: {},
                status: 400,
              },
            ],
          },
        });
      });

      const errObject = {
        data: '{}',
        message: 'Unknown OpenSearch error response',
      };

      try {
        await ctx.ds.query(query);
      } catch (err) {
        expect(err).toEqual(errObject);
      }
    });
  });

  describe('When getting fields', () => {
    beforeEach(() => {
      createDatasource({
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          database: 'genuine.es7._mapping.response',
          version: '1.0.0',
          flavor: Flavor.OpenSearch,
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);

      datasourceRequestMock.mockImplementation(options => {
        return Promise.resolve({
          data: {
            'genuine.es7._mapping.response': {
              mappings: {
                properties: {
                  '@timestamp_millis': {
                    type: 'date',
                    format: 'epoch_millis',
                  },
                  classification_terms: {
                    type: 'keyword',
                  },
                  domains: {
                    type: 'keyword',
                  },
                  ip_address: {
                    type: 'ip',
                  },
                  justification_blob: {
                    properties: {
                      criterion: {
                        type: 'text',
                        fields: {
                          keyword: {
                            type: 'keyword',
                            ignore_above: 256,
                          },
                        },
                      },
                      overall_vote_score: {
                        type: 'float',
                      },
                      shallow: {
                        properties: {
                          jsi: {
                            properties: {
                              sdb: {
                                properties: {
                                  dsel2: {
                                    properties: {
                                      'bootlegged-gille': {
                                        properties: {
                                          botness: {
                                            type: 'float',
                                          },
                                          general_algorithm_score: {
                                            type: 'float',
                                          },
                                        },
                                      },
                                      'uncombed-boris': {
                                        properties: {
                                          botness: {
                                            type: 'float',
                                          },
                                          general_algorithm_score: {
                                            type: 'float',
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  overall_vote_score: {
                    type: 'float',
                  },
                  ua_terms_long: {
                    type: 'keyword',
                  },
                  ua_terms_short: {
                    type: 'keyword',
                  },
                },
              },
            },
          },
        });
      });
    });

    it('should return nested fields', async () => {
      const fieldObjects = await ctx.ds.getFields();

      const fields = _.map(fieldObjects, 'text');

      expect(fields).toEqual([
        '@timestamp_millis',
        'classification_terms',
        'domains',
        'ip_address',
        'justification_blob.criterion.keyword',
        'justification_blob.criterion',
        'justification_blob.overall_vote_score',
        'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness',
        'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score',
        'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness',
        'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score',
        'overall_vote_score',
        'ua_terms_long',
        'ua_terms_short',
      ]);
    });

    it('should return number fields', async () => {
      const fieldObjects = await ctx.ds.getFields('number');

      const fields = _.map(fieldObjects, 'text');

      expect(fields).toEqual([
        'justification_blob.overall_vote_score',
        'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness',
        'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score',
        'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness',
        'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score',
        'overall_vote_score',
      ]);
    });

    it('should return date fields', async () => {
      const fieldObjects = await ctx.ds.getFields('date');

      const fields = _.map(fieldObjects, 'text');

      expect(fields).toEqual(['@timestamp_millis']);
    });
  });

  describe('When issuing aggregation query', () => {
    let requestOptions: any, parts: any, header: any;

    beforeEach(() => {
      createDatasource({
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          database: 'test',
          version: '1.0.0',
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);

      datasourceRequestMock.mockImplementation(options => {
        requestOptions = options;
        return Promise.resolve({ data: { responses: [] } });
      });

      const query: DataQueryRequest<OpenSearchQuery> = {
        range: createTimeRange(dateTime([2015, 4, 30, 10]), dateTime([2015, 5, 1, 10])),
        targets: [
          {
            refId: 'A',
            bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
            metrics: [{ type: 'count', id: '1' }],
            query: 'test',
          },
        ],
      } as DataQueryRequest<OpenSearchQuery>;

      ctx.ds.query(query);

      parts = requestOptions.data.split('\n');
      header = JSON.parse(parts[0]);
    });

    it('should not set search type to count', () => {
      expect(header.search_type).not.toEqual('count');
    });

    it('should set size to 0', () => {
      const body = JSON.parse(parts[1]);
      expect(body.size).toBe(0);
    });
  });

  describe('When issuing metricFind query', () => {
    let requestOptions: any, parts, header: any, body: any;
    let results: MetricFindValue[];

    beforeEach(() => {
      createDatasource({
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          database: 'test',
          version: '1.0.0',
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);

      datasourceRequestMock.mockImplementation(options => {
        requestOptions = options;
        return Promise.resolve({
          data: {
            responses: [
              {
                aggregations: {
                  '1': {
                    buckets: [
                      { doc_count: 1, key: 'test' },
                      {
                        doc_count: 2,
                        key: 'test2',
                        key_as_string: 'test2_as_string',
                      },
                    ],
                  },
                },
              },
            ],
          },
        });
      });

      ctx.ds.metricFindQuery('{"find": "terms", "field": "test"}').then(res => {
        results = res;
      });

      parts = requestOptions.data.split('\n');
      header = JSON.parse(parts[0]);
      body = JSON.parse(parts[1]);
    });

    it('should get results', () => {
      expect(results.length).toEqual(2);
    });

    it('should use key or key_as_string', () => {
      expect(results[0].text).toEqual('test');
      expect(results[1].text).toEqual('test2_as_string');
    });

    it('should not set search type to count', () => {
      expect(header.search_type).not.toEqual('count');
    });

    it('should set size to 0', () => {
      expect(body.size).toBe(0);
    });

    it('should not set terms aggregation size to 0', () => {
      expect(body['aggs']['1']['terms'].size).not.toBe(0);
    });
  });

  describe('PPL Queries', () => {
    const defaultPPLQuery =
      "source=`test` | where `@time` >= timestamp('2015-05-30 10:00:00') and `@time` <= timestamp('2015-06-01 10:00:00')";

    function setup(targets: OpenSearchQuery[]) {
      createDatasource({
        url: OPENSEARCH_MOCK_URL,
        database: 'test',
        jsonData: {
          database: 'test',
          version: '1.0.0',
          timeField: '@time',
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);

      const options: DataQueryRequest<OpenSearchQuery> = {
        requestId: '',
        interval: '',
        intervalMs: 1,
        scopedVars: {},
        timezone: '',
        app: CoreApp.Dashboard,
        startTime: 0,
        range: createTimeRange(toUtc([2015, 4, 30, 10]), toUtc([2015, 5, 1, 10])),
        targets,
      };

      return { ds: ctx.ds, options };
    }

    describe('When issuing empty PPL Query', () => {
      const payloads: any[] = [];

      const targets = [
        {
          queryType: QueryType.PPL,
          query: '',
          refId: 'A',
          isLogsQuery: false,
        },
      ];

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(options => {
          payloads.push(options);
          return Promise.resolve({ data: { schema: [], datarows: [] } });
        });
      });

      it('should send the correct data source request', async () => {
        const { ds, options } = setup(targets);
        await ds.query(options).toPromise();
        expect(payloads.length).toBe(1);
        expect(payloads[0].url).toBe(`${OPENSEARCH_MOCK_URL}/_opendistro/_ppl`);
        expect(JSON.parse(payloads[0].data).query).toBe(defaultPPLQuery);
      });

      it('should handle the data source response', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options)).toEmitValuesWith(received => {
          const result = received[0];
          expect(result).toEqual(
            expect.objectContaining({
              data: [],
            })
          );
        });
      });
    });

    describe('When issuing table format PPL Query', () => {
      const payloads: any[] = [];

      const targets = [
        {
          queryType: QueryType.PPL,
          query: 'source=`test` | where age > 21 | fields firstname, lastname',
          refId: 'A',
          format: 'table' as PPLFormatType,
          isLogsQuery: false,
        },
      ];

      const pplTableResponse = {
        data: {
          schema: [
            {
              name: 'firstname',
              type: 'string',
            },
            {
              name: 'lastname',
              type: 'string',
            },
          ],
          datarows: [
            ['Amber', 'Duke'],
            ['Hattie', 'Bond'],
          ],
          size: 2,
          total: 2,
        },
      };

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(options => {
          payloads.push(options);
          return Promise.resolve(pplTableResponse);
        });
      });

      it('should send the correct data source request', async () => {
        const { ds, options } = setup(targets);
        await ds.query(options).toPromise();
        const expectedQuery = `${defaultPPLQuery} | where age > 21 | fields firstname, lastname`;
        expect(payloads.length).toBe(1);
        expect(payloads[0].url).toBe(`${OPENSEARCH_MOCK_URL}/_opendistro/_ppl`);
        expect(JSON.parse(payloads[0].data).query).toBe(expectedQuery);
      });

      it('should handle the data source response', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options)).toEmitValuesWith((received: OpenSearchDataQueryResponse[]) => {
          const result = received[0];
          const dataFrame = result.data[0];
          expect(dataFrame.length).toBe(2);
          expect(dataFrame.refId).toBe('A');
          const fieldCache = new FieldCache(dataFrame);
          const field = fieldCache.getFieldByName('lastname');
          expect(field?.values.toArray()).toEqual(['Duke', 'Bond']);
        });
      });
    });

    describe('When issuing logs format PPL Query', () => {
      const payloads: any[] = [];

      const targets = [
        {
          queryType: QueryType.PPL,
          query: 'source=`test` | fields clientip, response',
          refId: 'B',
          format: 'logs' as PPLFormatType,
          isLogsQuery: false,
        },
      ];

      const pplLogsResponse = {
        data: {
          schema: [
            {
              name: 'clientip',
              type: 'string',
            },
            {
              name: 'response',
              type: 'string',
            },
          ],
          datarows: [
            ['10.0.0.1', '200'],
            ['10.0.0.2', '200'],
          ],
          size: 2,
          total: 2,
        },
      };

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(options => {
          payloads.push(options);
          return Promise.resolve(pplLogsResponse);
        });
      });

      it('should send the correct data source request', async () => {
        const { ds, options } = setup(targets);
        await ds.query(options).toPromise();
        const expectedQuery = `${defaultPPLQuery} | fields clientip, response`;
        expect(payloads.length).toBe(1);
        expect(payloads[0].url).toBe(`${OPENSEARCH_MOCK_URL}/_opendistro/_ppl`);
        expect(JSON.parse(payloads[0].data).query).toBe(expectedQuery);
      });

      it('should handle the data source response', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options)).toEmitValuesWith((received: OpenSearchDataQueryResponse[]) => {
          const result = received[0];
          const dataFrame = result.data[0] as DataFrame;
          expect(dataFrame.length).toBe(2);
          expect(dataFrame.refId).toBe('B');
          expect(dataFrame.meta?.preferredVisualisationType).toBe('logs');
          const fieldCache = new FieldCache(dataFrame);
          const field = fieldCache.getFieldByName('clientip');
          expect(field?.values.toArray()).toEqual(['10.0.0.1', '10.0.0.2']);
        });
      });
    });

    describe('When issuing time series format PPL Query', () => {
      const payloads: any[] = [];

      const targets = [
        {
          queryType: QueryType.PPL,
          query: 'source=`test` | stats count(response) by timestamp',
          refId: 'C',
          format: 'time_series' as PPLFormatType,
          isLogsQuery: false,
        },
      ];

      const pplTimeSeriesResponse = {
        data: {
          schema: [
            {
              name: 'count(response)',
              type: 'integer',
            },
            {
              name: 'time',
              type: 'timestamp',
            },
          ],
          datarows: [[4, '2015-06-01 00:00:00']],
          size: 1,
          total: 1,
        },
      };

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(options => {
          payloads.push(options);
          return Promise.resolve(pplTimeSeriesResponse);
        });
      });

      it('should send the correct data source request', async () => {
        const { ds, options } = setup(targets);
        await ds.query(options).toPromise();
        const expectedQuery = `${defaultPPLQuery} | stats count(response) by timestamp`;
        expect(payloads.length).toBe(1);
        expect(payloads[0].url).toBe(`${OPENSEARCH_MOCK_URL}/_opendistro/_ppl`);
        expect(JSON.parse(payloads[0].data).query).toBe(expectedQuery);
      });

      it('should handle the data source response', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options)).toEmitValuesWith((received: OpenSearchDataQueryResponse[]) => {
          const result = received[0];
          const timeSeries = result.data[0];
          expect(timeSeries.length).toBe(1);
          expect(timeSeries.refId).toBe('C');
          expect(timeSeries.name).toEqual('count(response)');
        });
      });
    });

    describe('When issuing two PPL Queries', () => {
      const payloads: any[] = [];

      const targets = [
        {
          queryType: QueryType.PPL,
          query: 'source=`test` | fields firstname',
          refId: 'A',
          format: 'table' as PPLFormatType,
          isLogsQuery: false,
        },
        {
          queryType: QueryType.PPL,
          query: 'source=`test` | fields lastname',
          refId: 'B',
          format: 'table' as PPLFormatType,
          isLogsQuery: false,
        },
      ];

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(options => {
          payloads.push(options);
          return Promise.resolve({ data: { schema: [], datarows: [] } });
        });
      });

      it('should send the correct data source requests', async () => {
        const { ds, options } = setup(targets);
        await ds.query(options).toPromise();
        const firstExpectedQuery = `${defaultPPLQuery} | fields firstname`;
        const secondExpectedQuery = `${defaultPPLQuery} | fields lastname`;

        expect(payloads.length).toBe(2);
        expect(payloads.some(payload => JSON.parse(payload.data).query === firstExpectedQuery));
        expect(payloads.some(payload => JSON.parse(payload.data).query === secondExpectedQuery));
      });

      it('should handle the data source responses', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options)).toEmitValuesWith((received: OpenSearchDataQueryResponse[]) => {
          expect(received.length).toBe(2);
          expect(received).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                data: [],
              }),
              expect.objectContaining({
                data: [],
              }),
            ])
          );
          expect(received[0].key && received[1].key && received[0].key !== received[1].key).toBe(true);
        });
      });
    });

    describe('When issuing PPL query and Lucene query', () => {
      const payloads: any[] = [];

      const targets = [
        {
          queryType: QueryType.PPL,
          query: '',
          refId: 'A',
          isLogsQuery: false,
        },
        {
          queryType: QueryType.Lucene,
          query: '*',
          refId: 'B',
          isLogsQuery: false,
        },
      ];

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(options => {
          payloads.push(options);
          if (options.url === `${OPENSEARCH_MOCK_URL}/_opendistro/_ppl`) {
            return Promise.resolve({ data: { schema: [], datarows: [] } });
          } else {
            return Promise.resolve({ data: { responses: [] } });
          }
        });
      });

      it('should send the correct data source requests', async () => {
        const { ds, options } = setup(targets);
        await ds.query(options).toPromise();
        expect(payloads.length).toBe(2);
        expect(payloads).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ url: `${OPENSEARCH_MOCK_URL}/_opendistro/_ppl` }),
            expect.objectContaining({ url: `${OPENSEARCH_MOCK_URL}/_msearch` }),
          ])
        );
      });

      it('should handle the data source responses', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options)).toEmitValuesWith((received: OpenSearchDataQueryResponse[]) => {
          expect(received.length).toBe(2);
          expect(received).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                data: [],
              }),
              expect.objectContaining({
                data: [],
              }),
            ])
          );
          expect(received[0].key && received[1].key && received[0].key !== received[1].key).toBe(true);
        });
      });
    });

    describe('When getting an error with reason in data source response', () => {
      const targets = [
        {
          queryType: QueryType.PPL,
          query: '',
          refId: 'A',
          isLogsQuery: false,
        },
      ];

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(() => {
          return Promise.resolve({
            data: {
              error: {
                reason: 'Error occurred in Elasticsearch engine: no such index [unknown]',
                details: 'org.elasticsearch.index.IndexNotFoundException: no such index [unknown]',
                type: 'IndexNotFoundException',
              },
              status: 404,
            },
          });
        });
      });

      it('should process it properly', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options).toPromise()).rejects.toEqual(
          expect.objectContaining({
            message: 'Error occurred in Elasticsearch engine: no such index [unknown]',
          })
        );
      });
    });

    describe('When getting an empty error in data source response', () => {
      const targets = [
        {
          queryType: QueryType.PPL,
          query: '',
          refId: 'A',
          isLogsQuery: false,
        },
      ];

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(() => {
          return Promise.resolve({
            data: {
              error: {},
              status: 404,
            },
          });
        });
      });

      it('should properly throw an unknown error', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options).toPromise()).rejects.toEqual(
          expect.objectContaining({
            message: 'Unknown OpenSearch error response',
          })
        );
      });
    });
  });

  describe('query', () => {
    it('should replace range as integer not string', () => {
      const dataSource = new OpenSearchDatasource({
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          database: '[asd-]YYYY.MM.DD',
          interval: 'Daily',
          version: '1.0.0',
          timeField: '@time',
        },
      } as DataSourceInstanceSettings<OpenSearchOptions>);

      (dataSource as any).post = jest.fn(() => Promise.resolve({ responses: [] }));
      dataSource.query(createOpenSearchQuery());

      const query = ((dataSource as any).post as jest.Mock).mock.calls[0][1];
      expect(typeof JSON.parse(query.split('\n')[1]).query.bool.filter[0].range['@time'].gte).toBe('number');
    });
  });

  it('should correctly interpolate variables in query', () => {
    const query: OpenSearchQuery = {
      refId: 'A',
      bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '$var', label: '' }] }, id: '1' }],
      metrics: [{ type: 'count', id: '1' }],
      query: '$var',
    };

    const interpolatedQuery = ctx.ds.interpolateVariablesInQueries([query], {})[0];

    expect(interpolatedQuery.query).toBe('resolvedVariable');
    expect((interpolatedQuery.bucketAggs![0] as Filters).settings!.filters![0].query).toBe('resolvedVariable');
  });

  it('should correctly handle empty query strings', () => {
    const query: OpenSearchQuery = {
      refId: 'A',
      bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '', label: '' }] }, id: '1' }],
      metrics: [{ type: 'count', id: '1' }],
      query: '',
    };

    const interpolatedQuery = ctx.ds.interpolateVariablesInQueries([query], {})[0];

    expect(interpolatedQuery.query).toBe('*');
    expect((interpolatedQuery.bucketAggs![0] as Filters).settings!.filters![0].query).toBe('*');
  });

  describe('getSupportedQueryTypes', () => {
    it('should return Lucene when no other types are set', () => {
      const instanceSettings = {
        jsonData: { pplEnabled: false } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>;
      const ds = new OpenSearchDatasource(instanceSettings);
      const supportedTypes = ds.getSupportedQueryTypes();
      expect(supportedTypes.length).toBe(1);
      expect(supportedTypes).toEqual([QueryType.Lucene]);
    });

    it('should return Lucene and PPL when PPL is set', () => {
      const instanceSettings = {
        jsonData: { pplEnabled: true } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>;
      const ds = new OpenSearchDatasource(instanceSettings);
      const supportedTypes = ds.getSupportedQueryTypes();
      expect(supportedTypes.length).toBe(2);
      expect(supportedTypes).toEqual(expect.arrayContaining([QueryType.Lucene, QueryType.PPL]));
    });
  });

  describe('getOpenSearchVersion', () => {
    it('should return OpenSearch version', async () => {
      let requestOptions: any;
      datasourceRequestMock.mockImplementation(options => {
        requestOptions = options;
        return Promise.resolve({ data: { version: { distribution: 'opensearch', number: '2.6.0' } } });
      });

      const version = await ctx.ds.getOpenSearchVersion();
      expect(version.flavor).toBe(Flavor.OpenSearch);
      expect(version.version).toBe('2.6.0');

      expect(requestOptions.url).toBe(`${OPENSEARCH_MOCK_URL}//`);
    });

    it('should return ElasticSearch version', async () => {
      datasourceRequestMock.mockImplementation(() => {
        return Promise.resolve({ data: { version: { number: '7.6.0' } } });
      });

      const version = await ctx.ds.getOpenSearchVersion();
      expect(version.flavor).toBe(Flavor.Elasticsearch);
      expect(version.version).toBe('7.6.0');
    });

    it('should error for invalid version', async () => {
      datasourceRequestMock.mockImplementation(() => {
        return Promise.resolve({ data: { version: { number: '7.11.1' } } });
      });
      await expect(() => ctx.ds.getOpenSearchVersion()).rejects.toThrow(
        'ElasticSearch version 7.11.1 is not supported by the OpenSearch plugin. Use the ElasticSearch plugin.'
      );
    });
  });
  describe('#executeLuceneQueries', () => {
    beforeEach(() => {
      createDatasource({
        uid: 'test',
        name: 'opensearch',
        type: 'opensearch',
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          database: '[asd-]YYYY.MM.DD',
          interval: 'Daily',
          version: '1.0.0',
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);
    });
    const logsTarget: OpenSearchQuery = {
      refId: 'logs',
      isLogsQuery: true,
      query: 'logsQuery',
    };
    const traceTarget: OpenSearchQuery = {
      refId: 'trace',
      luceneQueryType: LuceneQueryType.Traces,
      query: 'traceId: test',
    };
    const traceListTarget = (refId: string): OpenSearchQuery => ({
      refId,
      query: 'traceListQuery',
      luceneQueryType: LuceneQueryType.Traces,
    });
    const metricsTarget = (refId: string): OpenSearchQuery => ({
      refId,
      isLogsQuery: false,
      query: 'metricsQuery',
      luceneQueryType: LuceneQueryType.Metric,
      metrics: [
        {
          type: 'count',
        } as MetricAggregation,
      ],
    });

    it('can handle multiple trace list queries', async () => {
      const mockResponses = {
        responses: [emptyTraceListResponse.data.responses[0], emptyTraceListResponse.data.responses[0]],
      };
      datasourceRequestMock.mockImplementation(options => {
        return Promise.resolve({
          data: mockResponses,
        });
      });
      const result = await lastValueFrom(
        ctx.ds.query({
          ...createOpenSearchQuery([traceListTarget('traceList1'), traceListTarget('traceList2')]),
        })
      );
      expect(result.data[0].refId).toEqual('traceList1');
      expect(result.data[1].refId).toEqual('traceList2');
    });
    it('can handle multiple metrics queries', async () => {
      const mockResponses = {
        responses: [emptyMetricsResponse.data.responses[0], emptyMetricsResponse.data.responses[0]],
      };
      datasourceRequestMock.mockImplementation(options => {
        return Promise.resolve({
          data: mockResponses,
        });
      });
      const result = await lastValueFrom(
        ctx.ds.query({
          ...createOpenSearchQuery([metricsTarget('metrics1'), metricsTarget('metrics2')]),
        })
      );
      expect(result.data[0].refId).toEqual('metrics1');
      expect(result.data[1].refId).toEqual('metrics2');
    });

    it('can handle a trace list and a trace details query', async () => {
      datasourceRequestMock.mockImplementation(options => {
        if (options.data.includes('traceList')) {
          return Promise.resolve(emptyTraceListResponse);
        } else {
          return Promise.resolve(emptyTraceDetailsResponse);
        }
      });
      const resultTraceList = await firstValueFrom(
        ctx.ds.query({
          ...createOpenSearchQuery([traceListTarget('traceList'), traceTarget]),
        })
      );

      expect(resultTraceList.data[0].refId).toEqual('traceList');

      const resultTrace = await lastValueFrom(
        ctx.ds.query({
          ...createOpenSearchQuery([traceListTarget('traceList'), traceTarget]),
        })
      );

      expect(resultTrace.data[0].refId).toEqual('trace');
    });
    it('can handle a metrics and a trace list query', async () => {
      datasourceRequestMock.mockImplementation(options => {
        if (options.data.includes('traceList')) {
          return Promise.resolve(emptyTraceListResponse);
        } else {
          return Promise.resolve(emptyMetricsResponse);
        }
      });
      const resultTraceList = await firstValueFrom(
        ctx.ds.query({
          ...createOpenSearchQuery([traceListTarget('traceList'), metricsTarget('metrics')]),
        })
      );
      expect(resultTraceList.data[0].refId).toEqual('traceList');

      const resultMetrics = await lastValueFrom(
        ctx.ds.query({
          ...createOpenSearchQuery([traceListTarget('traceList'), metricsTarget('metrics')]),
        })
      );
      expect(resultMetrics.data[0].refId).toEqual('metrics');
    });
    it('can handle a metrics and a trace  query', async () => {
      datasourceRequestMock.mockImplementation(options => {
        if (options.data.includes('traceId')) {
          return Promise.resolve(emptyTraceDetailsResponse);
        } else {
          return Promise.resolve(emptyMetricsResponse);
        }
      });
      const resultTrace = await firstValueFrom(
        ctx.ds.query({
          ...createOpenSearchQuery([traceTarget, metricsTarget('metrics')]),
        })
      );
      expect(resultTrace.data[0].refId).toEqual('trace');

      const resultMetrics = await lastValueFrom(
        ctx.ds.query({
          ...createOpenSearchQuery([traceTarget, metricsTarget('metrics')]),
        })
      );
      expect(resultMetrics.data[0].refId).toEqual('metrics');
    });
    it('can handle a logs and a trace details  query', async () => {
      datasourceRequestMock.mockImplementation(options => {
        if (options.data.includes('traceId')) {
          return Promise.resolve(emptyTraceDetailsResponse);
        } else {
          return Promise.resolve(logsResponse);
        }
      });
      const result1 = await firstValueFrom(
        ctx.ds.query({
          ...createOpenSearchQuery([logsTarget, traceTarget]),
        })
      );
      expect(result1.data[0].refId).toEqual('trace');

      const result2 = await lastValueFrom(
        ctx.ds.query({
          ...createOpenSearchQuery([logsTarget, traceTarget]),
        })
      );
      expect(result2.data[0].refId).toEqual('logs');
    });
  });
});

describe('enhanceDataFrame', () => {
  it('adds links to dataframe', () => {
    const df = new MutableDataFrame({
      fields: [
        {
          name: 'urlField',
          values: new ArrayVector([]),
        },
        {
          name: 'traceField',
          values: new ArrayVector([]),
        },
      ],
    });

    enhanceDataFrame(df, [
      {
        field: 'urlField',
        url: 'someUrl',
      },
      {
        field: 'traceField',
        url: 'query',
        datasourceUid: 'dsUid',
      },
    ]);

    expect(df.fields[0].config.links!.length).toBe(1);
    expect(df.fields[0].config.links![0]).toEqual({
      title: '',
      url: 'someUrl',
    });
    expect(df.fields[1].config.links!.length).toBe(1);
    expect(df.fields[1].config.links![0]).toEqual({
      title: '',
      url: '',
      internal: {
        query: { query: 'query' },
        datasourceName: 'elastic25',
        datasourceUid: 'dsUid',
      },
    });
  });
});

const createOpenSearchQuery = (targets?: OpenSearchQuery[]): DataQueryRequest<OpenSearchQuery> => {
  return {
    requestId: '',
    dashboardId: 0,
    interval: '',
    panelId: 0,
    intervalMs: 1,
    scopedVars: {},
    timezone: '',
    app: CoreApp.Dashboard,
    startTime: 0,
    range: {
      from: dateTime([2015, 4, 30, 10]),
      to: dateTime([2015, 5, 1, 10]),
    } as any,
    targets: targets ?? [
      {
        refId: '',
        isLogsQuery: false,
        bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
        metrics: [{ type: 'count', id: '' }],
        query: 'test',
      },
    ],
  };
};

const logsResponse = {
  data: {
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
              '@timestamp': ['2019-06-24T09:51:19.765Z'],
              _id: 'iAmID',
              _type: '_doc',
              _index: 'mock-index',
              _source: {
                '@timestamp': '2019-06-24T09:51:19.765Z',
                host: 'iAmAHost',
                message: 'hello, i am a message',
              },
              fields: {
                '@timestamp': ['2019-06-24T09:51:19.765Z'],
              },
            },
            {
              '@timestamp': ['2019-06-24T09:52:19.765Z'],
              _id: 'iAmAnotherID',
              _type: '_doc',
              _index: 'mock-index',
              _source: {
                '@timestamp': '2019-06-24T09:52:19.765Z',
                host: 'iAmAnotherHost',
                message: 'hello, i am also message',
              },
              fields: {
                '@timestamp': ['2019-06-24T09:52:19.765Z'],
              },
            },
          ],
        },
      },
    ],
  },
};

const emptyTraceListResponse = {
  data: {
    responses: [
      {
        aggregations: {
          traces: {
            buckets: [],
          },
        },
      },
    ],
  },
};

const emptyTraceDetailsResponse = {
  data: {
    responses: [
      {
        hits: { hits: [] },
      },
    ],
  },
};
const emptyMetricsResponse = {
  data: {
    responses: [
      {
        aggregations: {
          '1': {
            buckets: [
              { doc_count: 1, key: 'test' },
              {
                doc_count: 2,
                key: 'test2',
                key_as_string: 'test2_as_string',
              },
            ],
          },
        },
      },
    ],
  },
};
