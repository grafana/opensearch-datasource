import {
  AdHocVariableFilter,
  CoreApp,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DateTime,
  Field,
  FieldType,
  MetricFindValue,
  SupplementaryQueryType,
  TimeRange,
  toUtc,
} from '@grafana/data';
import _ from 'lodash';
import { enhanceDataFrame, OpenSearchDatasource } from './opensearchDatasource';
import { DataSourceWithBackend } from '@grafana/runtime';
import { Flavor, OpenSearchOptions, OpenSearchQuery, QueryType } from './types';
import { DateHistogram, Filters } from './components/QueryEditor/BucketAggregationsEditor/aggregations';
import { matchers } from './dependencies/matchers';
import { firstValueFrom, lastValueFrom, of } from 'rxjs';

expect.extend(matchers);

const OPENSEARCH_MOCK_URL = 'http://opensearch.local';

const backendSrv = {
  datasourceRequest: jest.fn(),
};
const mockedSuperQuery = jest
  .spyOn(DataSourceWithBackend.prototype, 'query')
  .mockImplementation((request: DataQueryRequest<OpenSearchQuery>) => of());

jest.mock('./tracking.ts', () => ({
  trackQuery: jest.fn(),
}));

const getAdHocFiltersMock = jest.fn<AdHocVariableFilter[], any>(() => []);

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getBackendSrv: () => backendSrv,
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: () => {
        return { name: 'OSds' };
      },
    };
  },
  getTemplateSrv: () => ({
    replace: jest.fn((text: string | undefined) => {
      // Replace all $ words, except global variables ($__interval, $__interval_ms, etc.) - they get interpolated on the BE
      const resolved = text?.replace(/\$(?!__)\w+/g, 'resolvedVariable') ?? '';
      return resolved;
    }),
    getAdhocFilters: getAdHocFiltersMock,
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

describe('OpenSearchDatasource', function (this: any) {
  interface TestContext {
    ds: OpenSearchDatasource;
  }
  const ctx = {} as TestContext;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx.ds = new OpenSearchDatasource({} as DataSourceInstanceSettings<OpenSearchOptions>);
  });

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
        } as unknown as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);
    });

    it('should error', async () => {
      await expect(ctx.ds.testDatasource()).rejects.toMatchObject({
        status: 'error',
        message: 'No version set',
      });
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
      let resourcePath: any;
      ctx.ds.getResource = jest.fn().mockImplementation((path: string) => {
        resourcePath = path;
        return Promise.resolve({ data: {} });
      });

      ctx.ds.testDatasource();

      const today = toUtc().format('YYYY.MM.DD');
      expect(resourcePath).toBe(`asd-${today}/_mapping`);
    });
  });

  describe('When issuing metric query with interval pattern', () => {
    let query: any;

    beforeEach(async () => {
      createDatasource({
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          database: '[asd-]YYYY.MM.DD',
          interval: 'Daily',
          version: '1.0.0',
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);

      mockedSuperQuery.mockImplementation((request: DataQueryRequest<OpenSearchQuery>) => {
        return of({
          data: [],
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

      await ctx.ds.query(query);
    });

    it('should not resolve the variable in the original alias field in the query', () => {
      expect(query.targets[0].alias).toEqual('$varAlias');
    });
  });

  describe('When issuing logs query', () => {
    async function setupDataSource(jsonData?: Partial<OpenSearchOptions>): Promise<DataQueryResponse> {
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

      mockedSuperQuery.mockImplementation(() => {
        return of(logsResponse);
      });

      const query: DataQueryRequest<OpenSearchQuery> = {
        range: createTimeRange(toUtc([2015, 4, 30, 10]), toUtc([2019, 7, 1, 10])),
        targets: [
          {
            refId: 'A',
            query: 'escape\\:test',
            isLogsQuery: true,
          },
        ],
      } as DataQueryRequest<OpenSearchQuery>;
      const response: DataQueryResponse = await firstValueFrom(ctx.ds.query(query));
      return response;
    }

    it('should call super.query()', async () => {
      setupDataSource();
      expect(mockedSuperQuery).toHaveBeenCalled();
    });

    it('should enhance fields with links', async () => {
      const response = await setupDataSource({
        dataLinks: [
          {
            field: 'host',
            url: 'http://localhost:3000/${__value.raw}',
            title: 'Host',
          },
        ],
      });

      expect(response?.data.length).toBe(1);
      const links = response?.data[0].fields.find((field: Field) => field.name === 'host').config.links;
      expect(links.length).toBe(1);
      expect(links[0].url).toBe('http://localhost:3000/${__value.raw}');
      expect(links[0].title).toBe('Host');
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

      ctx.ds.getResource = jest.fn().mockResolvedValue({
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

  describe('When issuing metricFind query', () => {
    let results: MetricFindValue[];
    let mockResource = jest.fn().mockResolvedValue({});

    beforeEach(() => {
      createDatasource({
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          database: 'test',
          version: '1.0.0',
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);

      mockResource = jest.fn().mockImplementation((options) => {
        return Promise.resolve({
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
                    {
                      doc_count: 2,
                      key: 5,
                    },
                  ],
                },
              },
            },
          ],
        });
      });
      ctx.ds.postResource = mockResource;

      ctx.ds.metricFindQuery('{"find": "terms", "field": "test"}').then((res) => {
        results = res;
      });
    });

    it('should get results with script', () => {
      ctx.ds.metricFindQuery('{"find": "terms", "script": "test"}').then((res) => {
        results = res;
      });

      expect(results.length).toEqual(3);
    });

    it('should get results', () => {
      expect(results.length).toEqual(3);
    });

    it('should use key or key_as_string', () => {
      expect(results[0].text).toEqual('test');
      expect(results[1].text).toEqual('test2_as_string');
      expect(results[2].text).toEqual('5');
    });

    it('should not set search type to count', () => {
      const data = mockResource.mock.lastCall[1];
      const dataArray = data.split('\n');
      const header = JSON.parse(dataArray[0]);
      expect(header.search_type).not.toBe('count');
    });

    it('should set size to 0', () => {
      const data = mockResource.mock.lastCall[1];
      const dataArray = data.split('\n');
      const body = JSON.parse(dataArray[1]);
      expect(body.size).toBe(0);
    });

    it('should not set terms aggregation size to 0', () => {
      const data = mockResource.mock.lastCall[1];
      const dataArray = data.split('\n');
      const body = JSON.parse(dataArray[1]);
      expect(body['aggs']['1']['terms'].size).not.toBe(0);
    });
  });

  describe('When calling getTagValues', () => {
    const timeRangeMock = createTimeRange(toUtc([2022, 8, 21, 6, 10, 10]), toUtc([2022, 8, 24, 6, 10, 21]));
    let results: MetricFindValue[];
    let mockResource = jest.fn().mockResolvedValue({});

    beforeEach(() => {
      mockResource.mockClear();
      createDatasource({
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          database: 'test',
          version: '1.0.0',
          timeField: '@timestamp',
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);

      mockResource = jest.fn().mockImplementation((options) => {
        return Promise.resolve({
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
                    {
                      doc_count: 2,
                      key: 5,
                    },
                  ],
                },
              },
            },
          ],
        });
      });
      ctx.ds.postResource = mockResource;
      ctx.ds.getTagValues({ key: 'test', timeRange: timeRangeMock, filters: [] }).then((res) => {
        results = res;
      });
    });

    it('should respect the currently selected time range', () => {
      expect(mockResource).toHaveBeenCalledTimes(1);
      const esQuery = JSON.parse(mockResource.mock.calls[0][1].split('\n')[1]);
      const { lte, gte } = esQuery.query.bool.filter[0].range['@timestamp'];

      expect(gte).toBe('1663740610000'); // 2022-09-21T06:10:10Z
      expect(lte).toBe('1663999821000'); // 2022-09-24T06:10:21Z
    });

    it('should return numbers as strings', async () => {
      expect(mockResource).toHaveBeenCalledTimes(1);

      expect(results.length).toBe(3);
      expect(results[0].text).toBe('test');
      expect(results[0].value).toBe('test');

      expect(results[1].text).toBe('test2_as_string');
      expect(results[1].value).toBe('test2');

      expect(results[2].text).toBe('5');
      expect(results[2].value).toBe('5');
    });
  });

  describe('annotationQuery', () => {
    describe('results processing', () => {
      it('should return simple annotations using defaults', async () => {
        const mockResource = jest.fn().mockResolvedValue({
          responses: [
            {
              hits: {
                hits: [
                  { _source: { '@timestamp': 1, tags: 'foo', text: 'abc' } },
                  { _source: { '@timestamp': 3, tags: 'bar', text: 'def' } },
                ],
              },
            },
          ],
        });
        ctx.ds.postResource = mockResource;

        const annotations = await ctx.ds.annotationQuery({
          annotation: { query: 'abc' },
          range: createTimeRange(toUtc([2015, 4, 30, 10]), toUtc([2015, 5, 1, 10])),
        });

        expect(annotations).toHaveLength(2);
        expect(annotations[0].time).toBe(1);
        expect(annotations[0].tags?.[0]).toBe('foo');
        expect(annotations[0].text).toBe(undefined);
        expect(annotations[1].time).toBe(3);
        expect(annotations[1].tags?.[0]).toBe('bar');
        expect(annotations[1].text).toBe(undefined);
      });

      it('should return annotation events using options', async () => {
        const mockResource = jest.fn().mockResolvedValue({
          responses: [
            {
              hits: {
                hits: [
                  { _source: { '@test_time': 1, '@test_tags': 'foo', text: 'abc' } },
                  { _source: { '@test_time': 3, '@test_tags': 'bar', text: 'def' } },
                ],
              },
            },
          ],
        });
        ctx.ds.postResource = mockResource;

        const annotations = await ctx.ds.annotationQuery({
          annotation: {
            timeField: '@test_time',
            name: 'foo',
            query: 'abc',
            tagsField: '@test_tags',
            textField: 'text',
          },
          range: createTimeRange(toUtc([2015, 4, 30, 10]), toUtc([2015, 5, 1, 10])),
        });
        expect(annotations).toHaveLength(2);
        expect(annotations[0].time).toBe(1);
        expect(annotations[0].tags?.[0]).toBe('foo');
        expect(annotations[0].text).toBe('abc');

        expect(annotations[1].time).toBe(3);
        expect(annotations[1].tags?.[0]).toBe('bar');
        expect(annotations[1].text).toBe('def');
      });
    });
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
    beforeEach(() => {
      ctx.ds = new OpenSearchDatasource({} as DataSourceInstanceSettings<OpenSearchOptions>);
    });
    it('should return OpenSearch version', async () => {
      const mockResource = jest.fn().mockResolvedValue({
        version: { distribution: 'opensearch', number: '2.6.0' },
      });
      ctx.ds.getResource = mockResource;

      const version = await ctx.ds.getOpenSearchVersion();
      expect(version.flavor).toBe(Flavor.OpenSearch);
      expect(version.version).toBe('2.6.0');
      expect(version.label).toBe('OpenSearch 2.6.0');

      expect(mockResource.mock.lastCall[0]).toBe('');
    });

    it('should return ElasticSearch version', async () => {
      ctx.ds.getResource = jest.fn().mockResolvedValue({
        version: { number: '7.6.0' },
      });

      const version = await ctx.ds.getOpenSearchVersion();
      expect(version.flavor).toBe(Flavor.Elasticsearch);
      expect(version.version).toBe('7.6.0');
      expect(version.label).toBe('ElasticSearch 7.6.0');
    });

    it('should error for invalid version', async () => {
      ctx.ds.getResource = jest.fn().mockResolvedValue({
        version: { number: '7.11.1' },
      });
      await expect(() => ctx.ds.getOpenSearchVersion()).rejects.toThrow(
        'ElasticSearch version 7.11.1 is not supported by the OpenSearch plugin. Use the ElasticSearch plugin.'
      );
    });

    it('should return ElasticSearch for ElasticSearch 7.10.2 without tagline', async () => {
      ctx.ds.getResource = jest.fn().mockResolvedValue({
        version: { number: '7.10.2' },
      });
      const version = await ctx.ds.getOpenSearchVersion();
      expect(version.flavor).toBe(Flavor.Elasticsearch);
      expect(version.version).toBe('7.10.2');
      expect(version.label).toBe('ElasticSearch 7.10.2');
    });

    it('should return OpenSearch for ElasticSearch 7.10.2 with tagline', async () => {
      ctx.ds.getResource = jest.fn().mockResolvedValue({
        version: { number: '7.10.2' },
        tagline: 'The OpenSearch Project: https://opensearch.org/',
      });
      const version = await ctx.ds.getOpenSearchVersion();
      expect(version.flavor).toBe(Flavor.OpenSearch);
      expect(version.version).toBe('1.0.0');
      expect(version.label).toBe('OpenSearch (compatibility mode)');
    });
  });

  describe('addAdHocFilters', () => {
    const adHocFilters = [{ key: 'test', operator: '=', value: 'test1', condition: '' }];
    describe('with invalid filters', () => {
      describe('Lucene queries', () => {
        it('should filter out ad hoc filter without key', () => {
          const query = ctx.ds.addAdHocFilters({ refId: 'A', query: 'foo:"bar"', queryType: QueryType.Lucene }, [
            { key: '', operator: '=', value: 'a', condition: '' },
          ]);
          expect(query).toBe('foo:"bar"');
        });

        it('should filter out ad hoc filter without key when query is empty', () => {
          const query = ctx.ds.addAdHocFilters({ refId: 'A', query: '', queryType: QueryType.Lucene }, [
            { key: '', operator: '=', value: 'a', condition: '' },
          ]);
          expect(query).toBe('*');
        });

        it('should filter out ad hoc filter without value', () => {
          const query = ctx.ds.addAdHocFilters({ refId: 'A', query: 'foo:"bar"', queryType: QueryType.Lucene }, [
            { key: 'a', operator: '=', value: '', condition: '' },
          ]);
          expect(query).toBe('foo:"bar"');
        });

        it('should filter out filter ad hoc filter with invalid operator', () => {
          const query = ctx.ds.addAdHocFilters({ refId: 'A', query: 'foo:"bar"', queryType: QueryType.Lucene }, [
            { key: 'a', operator: 'A', value: '', condition: '' },
          ]);
          expect(query).toBe('foo:"bar"');
        });
      });

      describe('PPL queries', () => {
        it('should filter out ad hoc filter without key', () => {
          const query = ctx.ds.addAdHocFilters({ refId: 'A', query: 'source = test-index', queryType: QueryType.PPL }, [
            { key: '', operator: '=', value: 'a', condition: '' },
          ]);
          expect(query).toBe('source = test-index');
        });

        it('should filter out ad hoc filter without value', () => {
          const query = ctx.ds.addAdHocFilters({ refId: 'A', query: 'source = test-index', queryType: QueryType.PPL }, [
            { key: 'a', operator: '=', value: '', condition: '' },
          ]);
          expect(query).toBe('source = test-index');
        });

        it('should filter out ad hoc filter with invalid operators', () => {
          const query = ctx.ds.addAdHocFilters({ refId: 'A', query: 'source = test-index', queryType: QueryType.PPL }, [
            { key: 'a', operator: '=~', value: 'test', condition: '' },
            { key: 'a', operator: '!~', value: 'test', condition: '' },
          ]);
          expect(query).toBe('source = test-index');
        });
      });
    });

    describe('queries with 1 ad hoc filter', () => {
      it('should correctly add 1 ad hoc filter when Lucene query is not empty', () => {
        const query = ctx.ds.addAdHocFilters(
          { refId: 'A', query: 'foo:"bar"', queryType: QueryType.Lucene },
          adHocFilters
        );
        expect(query).toBe('foo:"bar" AND test:"test1"');
      });

      it('should correctly add 1 ad hoc filter when PPL query is not empty', () => {
        const query = ctx.ds.addAdHocFilters(
          { refId: 'A', query: 'foo="bar"', queryType: QueryType.PPL },
          adHocFilters
        );
        expect(query).toBe('foo="bar" | where `test` = \'test1\'');
      });
    });

    describe('Empty queries with 1 ad hoc filter', () => {
      it('Lucene queries should correctly add 1 ad hoc filter when query is empty', () => {
        // an empty string query is transformed to '*' but this can be refactored to have the same behavior as Elasticsearch
        const query = ctx.ds.addAdHocFilters({ refId: 'A', query: '', queryType: QueryType.Lucene }, adHocFilters);
        expect(query).toBe('test:"test1"');
      });

      it('PPL queries should correctly add 1 ad hoc filter when query is empty', () => {
        // an empty string query is transformed to '*' but this can be refactored to have the same behavior as Elasticsearch
        const query = ctx.ds.addAdHocFilters({ refId: 'A', query: '', queryType: QueryType.PPL }, adHocFilters);
        expect(query).toBe("`test` = 'test1'");
      });
    });

    describe('Escaping characters in adhoc filter', () => {
      it('should escape characters in filter keys in Lucene queries', () => {
        const query = ctx.ds.addAdHocFilters({ refId: 'A', query: '', queryType: QueryType.Lucene }, [
          { key: 'field:name', operator: '=', value: 'field:value', condition: '' },
        ]);
        expect(query).toBe('field\\:name:"field:value"');
      });
    });

    describe('with multiple ad hoc filters', () => {
      describe('Lucene queries', () => {
        const adHocFilters = [
          { key: 'bar', operator: '=', value: 'baz', condition: '' },
          { key: 'job', operator: '!=', value: 'grafana', condition: '' },
          { key: 'service', operator: '=~', value: 'service', condition: '' },
          { key: 'count', operator: '>', value: '1', condition: '' },
        ];

        it('should correctly add ad hoc filters when query is not empty', () => {
          const query = ctx.ds.addAdHocFilters(
            { refId: 'A', query: 'foo:"bar" AND test:"test1"', queryType: QueryType.Lucene },
            adHocFilters
          );
          expect(query).toBe(
            'foo:"bar" AND test:"test1" AND bar:"baz" AND -job:"grafana" AND service:/service/ AND count:>1'
          );
        });

        it('should correctly add ad hoc filters when query is  empty', () => {
          const query = ctx.ds.addAdHocFilters({ refId: 'A', query: '', queryType: QueryType.Lucene }, adHocFilters);
          expect(query).toBe('bar:"baz" AND -job:"grafana" AND service:/service/ AND count:>1');
        });
      });

      describe('PPL queries', () => {
        it('should return query with ad-hoc filters applied', () => {
          const adHocFilters: AdHocVariableFilter[] = [
            { key: 'bar', operator: '=', value: 'baz', condition: '' },
            { key: 'job', operator: '!=', value: 'grafana', condition: '' },
            { key: 'bytes', operator: '>', value: '50', condition: '' },
            { key: 'count', operator: '<', value: '100', condition: '' },
            { key: 'timestamp', operator: '=', value: '2020-11-22 16:40:43', condition: '' },
          ];
          const query = ctx.ds.addAdHocFilters(
            { refId: 'A', query: 'source = test-index', queryType: QueryType.PPL },
            adHocFilters
          );
          expect(query).toBe(
            "source = test-index | where `bar` = 'baz' and `job` != 'grafana' and `bytes` > 50 and `count` < 100 and `timestamp` = timestamp('2020-11-22 16:40:43.000000')"
          );
        });
      });
    });
  });

  describe('interpolateQueries for Explore', () => {
    const adHocFilters = [
      { key: 'bar', operator: '=', value: 'baz', condition: '' },
      { key: 'job', operator: '!=', value: 'grafana', condition: '' },
      { key: 'bytes', operator: '>', value: '50', condition: '' },
      { key: 'count', operator: '<', value: '100', condition: '' },
      { key: 'timestamp', operator: '=', value: '2020-11-22 16:40:43', condition: '' },
    ];
    it('correctly applies template variables and adhoc filters to Lucene queries', () => {
      const query: OpenSearchQuery = {
        refId: 'A',
        queryType: QueryType.Lucene,
        bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '$var', label: '' }] }, id: '1' }],
        metrics: [{ type: 'count', id: '1' }],
        query: '$var',
      };

      const interpolatedQueries = ctx.ds.interpolateVariablesInQueries([query], {}, adHocFilters);
      expect(interpolatedQueries[0].query).toBe(
        'resolvedVariable AND bar:"baz" AND -job:"grafana" AND bytes:>50 AND count:<100 AND timestamp:"2020-11-22 16:40:43"'
      );
    });

    it('should correctly apply template variables and adhoc filters to PPL queries', () => {
      const query: OpenSearchQuery = {
        refId: 'A',
        queryType: QueryType.PPL,
        bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '$var', label: '' }] }, id: '1' }],
        metrics: [{ type: 'count', id: '1' }],
        query: '$var',
      };

      const interpolatedQueries = ctx.ds.interpolateVariablesInQueries([query], {}, adHocFilters);
      expect(interpolatedQueries[0].query).toBe(
        "resolvedVariable | where `bar` = 'baz' and `job` != 'grafana' and `bytes` > 50 and `count` < 100 and `timestamp` = timestamp('2020-11-22 16:40:43.000000')"
      );
    });
  });

  describe('applyTemplateVariables', () => {
    it('should correctly handle empty query strings in Lucene queries', () => {
      const query: OpenSearchQuery = {
        refId: 'A',
        bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '', label: '' }] }, id: '1' }],
        metrics: [{ type: 'count', id: '1' }],
        query: '',
      };

      const interpolatedQuery = ctx.ds.applyTemplateVariables(query, {});

      expect(interpolatedQuery.query).toBe('*');
      expect((interpolatedQuery.bucketAggs![0] as Filters).settings!.filters![0].query).toBe('*');
    });

    it('should correctly interpolate variables in Lucene query', () => {
      const query: OpenSearchQuery = {
        refId: 'A',
        bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '$var', label: '' }] }, id: '1' }],
        metrics: [{ type: 'count', id: '1' }],
        query: '$var AND foo:bar',
      };

      const interpolatedQuery = ctx.ds.applyTemplateVariables(query, {});

      expect(interpolatedQuery.query).toBe('resolvedVariable AND foo:bar');
      expect((interpolatedQuery.bucketAggs![0] as Filters).settings!.filters![0].query).toBe('resolvedVariable');
    });

    it('should correctly interpolate variables in nested fields in Lucene query', () => {
      const query: OpenSearchQuery = {
        refId: 'A',
        bucketAggs: [
          {
            field: 'avgPrice',
            settings: { interval: '$var', min_doc_count: '$var', trimEdges: '$var' },
            type: 'date_histogram',
            id: '1',
          },
        ],
        metrics: [{ type: 'count', id: '1' }],
        query: '$var AND foo:bar',
      };

      const interpolatedQuery = ctx.ds.applyTemplateVariables(query, {});

      expect((interpolatedQuery.bucketAggs![0] as DateHistogram).settings!.interval).toBe('resolvedVariable');
      expect((interpolatedQuery.bucketAggs![0] as DateHistogram).settings!.min_doc_count).toBe('resolvedVariable');
      expect((interpolatedQuery.bucketAggs![0] as DateHistogram).settings!.trimEdges).toBe('resolvedVariable');
    });

    it('correctly applies template variables and adhoc filters to Lucene queries', () => {
      const adHocFilters: AdHocVariableFilter[] = [
        { key: 'bar', operator: '=', value: 'baz', condition: '' },
        { key: 'job', operator: '!=', value: 'grafana', condition: '' },
        { key: 'bytes', operator: '>', value: '50', condition: '' },
        { key: 'count', operator: '<', value: '100', condition: '' },
        { key: 'timestamp', operator: '=', value: '2020-11-22 16:40:43', condition: '' },
      ];
      const query: OpenSearchQuery = {
        refId: 'A',
        queryType: QueryType.Lucene,
        bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '$var', label: '' }] }, id: '1' }],
        metrics: [{ type: 'count', id: '1' }],
        query: '$var',
      };

      // called from grafana runtime
      const interpolatedQuery = ctx.ds.applyTemplateVariables(query, {}, adHocFilters);
      expect(interpolatedQuery.query).toBe(
        'resolvedVariable AND bar:"baz" AND -job:"grafana" AND bytes:>50 AND count:<100 AND timestamp:"2020-11-22 16:40:43"'
      );
    });

    it('correctly applies template variables and adhoc filters to PPL queries', () => {
      const adHocFilters: AdHocVariableFilter[] = [
        { key: 'bar', operator: '=', value: 'baz', condition: '' },
        { key: 'job', operator: '!=', value: 'grafana', condition: '' },
        { key: 'bytes', operator: '>', value: '50', condition: '' },
        { key: 'count', operator: '<', value: '100', condition: '' },
        { key: 'timestamp', operator: '=', value: '2020-11-22 16:40:43', condition: '' },
      ];
      const query: OpenSearchQuery = {
        refId: 'A',
        queryType: QueryType.PPL,
        bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '$var', label: '' }] }, id: '1' }],
        metrics: [{ type: 'count', id: '1' }],
        query: '$var',
      };

      const interpolatedQuery = ctx.ds.applyTemplateVariables(query, {}, adHocFilters);
      expect(interpolatedQuery.query).toBe(
        "resolvedVariable | where `bar` = 'baz' and `job` != 'grafana' and `bytes` > 50 and `count` < 100 and `timestamp` = timestamp('2020-11-22 16:40:43.000000')"
      );
    });
  });

  describe('Data links', () => {
    it('should add links to dataframe for logs queries', async () => {
      createDatasource({
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          database: '[asd-]YYYY.MM.DD',
          interval: 'Daily',
          version: '1.0.0',
          dataLinks: [
            {
              field: 'geo.coordinates.lat',
              url: 'someUrl',
            },
            {
              field: 'geo.coordinates.lon',
              url: 'query',
              datasourceUid: 'dsUid',
            },
          ],
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);

      const mockedSuperQuery = jest
        .spyOn(DataSourceWithBackend.prototype, 'query')
        .mockImplementation((_: DataQueryRequest<OpenSearchQuery>) => of(dataLinkResponse));
      const logsQuery: OpenSearchQuery = {
        refId: 'A',
        metrics: [{ type: 'logs', id: '1' }],
        query: 'foo="bar"',
        queryType: QueryType.Lucene,
      };
      const request: DataQueryRequest<OpenSearchQuery> = {
        requestId: '',
        interval: '',
        intervalMs: 1,
        scopedVars: {},
        timezone: '',
        app: CoreApp.Explore,
        startTime: 0,
        range: createTimeRange(toUtc([2015, 4, 30, 10]), toUtc([2015, 5, 1, 10])),
        targets: [logsQuery],
      };
      const result = await lastValueFrom(ctx.ds.query(request));

      expect(mockedSuperQuery).toHaveBeenCalled();

      expect(result.data[0].fields[1].config.links?.length).toBe(1);
      expect(result.data[0].fields[1].config.links?.[0]).toEqual({
        title: '',
        url: 'someUrl',
      });
      expect(result.data[0].fields[2].config.links!.length).toBe(1);
      expect(result.data[0].fields[2].config.links![0]).toEqual({
        title: '',
        url: '',
        internal: {
          query: { query: 'query' },
          datasourceName: 'OSds',
          datasourceUid: 'dsUid',
        },
      });
    });
  });

  describe('getSupplementaryQuery', () => {
    let ds: OpenSearchDatasource;
    beforeEach(() => {
      createDatasource({
        url: OPENSEARCH_MOCK_URL,
        jsonData: {
          database: '[asd-]YYYY.MM.DD',
          interval: 'Daily',
          version: '1.0.0',
          dataLinks: [
            {
              field: 'geo.coordinates.lat',
              url: 'someUrl',
            },
            {
              field: 'geo.coordinates.lon',
              url: 'query',
              datasourceUid: 'dsUid',
            },
          ],
        } as OpenSearchOptions,
      } as DataSourceInstanceSettings<OpenSearchOptions>);
      ds = ctx.ds;
    });
    it('does not return logs volume query for metric query', () => {
      expect(
        ds.getSupplementaryQuery(
          { type: SupplementaryQueryType.LogsVolume },
          {
            refId: 'A',
            metrics: [{ type: 'count', id: '1' }],
            bucketAggs: [{ type: 'filters', settings: { filters: [{ query: 'foo', label: '' }] }, id: '1' }],
            query: 'foo="bar"',
          }
        )
      ).toEqual(undefined);
    });
    it('returns logs volume query for log query', () => {
      expect(
        ds.getSupplementaryQuery(
          { type: SupplementaryQueryType.LogsVolume },
          {
            refId: 'A',
            metrics: [{ type: 'logs', id: '1' }],
            query: 'foo="bar"',
          }
        )
      ).toEqual({
        bucketAggs: [
          {
            field: '@timestamp',
            id: '3',
            settings: {
              interval: 'auto',
              min_doc_count: '0',
              trimEdges: '0',
            },
            type: 'date_histogram',
          },
        ],
        metrics: [
          {
            id: '1',
            type: 'count',
          },
        ],
        query: 'foo="bar"',
        refId: 'log-volume-A',
        timeField: '@timestamp',
      });
    });
    it('does not return logs volume query for hidden log query', () => {
      expect(
        ds.getSupplementaryQuery(
          { type: SupplementaryQueryType.LogsVolume },
          {
            refId: 'A',
            metrics: [{ type: 'logs', id: '1' }],
            query: 'foo="bar"',
            hide: true,
          }
        )
      ).toEqual(undefined);
    });
  });
});

describe('enhanceDataFrame', () => {
  it('adds links to dataframe', () => {
    const df: DataFrame = {
      length: 0,
      fields: [
        {
          config: {},
          name: 'urlField',
          values: [],
          type: FieldType.string,
        },
        {
          config: {},
          name: 'traceField',
          values: [],
          type: FieldType.string,
        },
      ],
    };

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
        datasourceName: 'OSds',
        datasourceUid: 'dsUid',
      },
    });
  });
});

const logsResponse: DataQueryResponse = {
  data: [
    {
      refId: 'A',
      meta: {},
      name: 'logs',
      fields: [
        {
          config: {},
          name: '@timestamp',
          values: [['2019-06-24T09:51:19.765Z', '2019-06-24T09:52:19.765Z']],
        },
        {
          config: {},
          name: 'message',
          values: [['message1', 'message2']],
        },
        {
          config: {},
          name: 'host',
          values: [['host1', 'host2']],
        },
      ],
    },
  ],
};

const dataLinkResponse: DataQueryResponse = {
  data: [
    {
      refId: 'A',
      meta: {},
      fields: [
        {
          name: 'timestamp',
          type: 'time',
          typeInfo: {
            frame: 'time.Time',
            nullable: true,
          },
          config: {
            filterable: true,
          },
          values: [1682432036905],
          entities: {},
        },
        {
          name: 'geo.coordinates.lat',
          type: 'number',
          typeInfo: {
            frame: 'float64',
            nullable: true,
          },
          config: {
            filterable: true,
          },
          values: [45.36216083],
          entities: {},
        },
        {
          name: 'geo.coordinates.lon',
          type: 'number',
          typeInfo: {
            frame: 'float64',
            nullable: true,
          },
          config: {
            filterable: true,
          },
          values: [-68.53474694],
          entities: {},
        },
      ],
      length: 500,
    },
  ],
};
