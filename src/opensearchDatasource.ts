import _ from 'lodash';
import { Observable, of, from } from 'rxjs';
import { map, tap, mergeMap } from 'rxjs/operators';
import {
  DataSourceInstanceSettings,
  DataQueryRequest,
  DataQueryResponse,
  DataFrame,
  ScopedVars,
  DataLink,
  MetricFindValue,
  TimeRange,
  toUtc,
  getDefaultTimeRange,
  ToggleFilterAction,
  QueryFilterOptions,
  AdHocVariableFilter,
  AnnotationEvent,
  DataSourceWithSupplementaryQueriesSupport,
  LogLevel,
  SupplementaryQueryOptions,
  SupplementaryQueryType,
  LoadingState,
  LiveChannelScope,
} from '@grafana/data';
import { IndexPattern } from './index_pattern';
import { QueryBuilder } from './QueryBuilder';
import {
  BackendSrvRequest,
  DataSourceWithBackend,
  FetchError,
  HealthCheckError,
  TemplateSrv,
  getDataSourceSrv,
  getTemplateSrv,
  getGrafanaLiveSrv,
} from '@grafana/runtime';
import {
  DataLinkConfig,
  Flavor,
  OpenSearchAnnotationQuery,
  OpenSearchOptions,
  OpenSearchQuery,
  QueryType,
} from './types';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';
import {
  isMetricAggregationWithField,
  isPipelineAggregationWithMultipleBucketPaths,
} from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { bucketAggregationConfig } from './components/QueryEditor/BucketAggregationsEditor/utils';
import {
  isBucketAggregationWithField,
  BucketAggregation,
} from './components/QueryEditor/BucketAggregationsEditor/aggregations';
import { gte, lt, satisfies, valid } from 'semver';
import { OpenSearchAnnotationsQueryEditor } from './components/QueryEditor/AnnotationQueryEditor';
import { trackQuery } from 'tracking';
import { enhanceDataFramesWithDataLinks, sha256 } from 'utils';
import { AVAILABLE_FLAVORS, Version } from 'configuration/utils';
import {
  PPLQueryHasFilter,
  addAdhocFilterToPPLQuery,
  addLuceneAdHocFilter,
  luceneQueryHasFilter,
  toggleQueryFilterForLucene,
  toggleQueryFilterForPPL,
} from 'modifyQuery';

// Those are metadata fields as defined in https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-fields.html#_identity_metadata_fields.
// custom fields can start with underscores, therefore is not safe to exclude anything that starts with one.
const META_FIELDS = ['_index', '_type', '_id', '_source', '_size', '_field_names', '_ignored', '_routing', '_meta'];
export const REF_ID_STARTER_LOG_VOLUME = 'log-volume-';

export class OpenSearchDatasource
  extends DataSourceWithBackend<OpenSearchQuery, OpenSearchOptions>
  implements DataSourceWithSupplementaryQueriesSupport<OpenSearchQuery>
{
  basicAuth?: string;
  withCredentials?: boolean;
  url: string;
  name: string;
  uid: string;
  type: string;
  index: string;
  timeField: string;
  flavor: Flavor;
  version: string;
  interval: string;
  maxConcurrentShardRequests?: number;
  queryBuilder: QueryBuilder;
  indexPattern: IndexPattern;
  logMessageField?: string;
  logLevelField?: string;
  dataLinks: DataLinkConfig[];
  pplEnabled?: boolean;
  sigV4Auth?: boolean;
  private isHandlingLiveStreaming = false;

  constructor(
    instanceSettings: DataSourceInstanceSettings<OpenSearchOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.url = instanceSettings.url!;
    this.name = instanceSettings.name;
    this.uid = instanceSettings.uid;
    this.type = instanceSettings.type;
    const settingsData = instanceSettings.jsonData || ({} as OpenSearchOptions);
    this.index = settingsData.database ?? '';

    this.timeField = settingsData.timeField;
    this.flavor = settingsData.flavor || Flavor.OpenSearch;
    this.version = settingsData.version;
    this.indexPattern = new IndexPattern(this.index, settingsData.interval);
    this.interval = settingsData.timeInterval;
    this.maxConcurrentShardRequests = settingsData.maxConcurrentShardRequests;
    this.queryBuilder = new QueryBuilder({
      timeField: this.timeField,
      flavor: this.flavor,
      version: this.version,
    });
    this.logMessageField = settingsData.logMessageField || '';
    this.logLevelField = settingsData.logLevelField || '';
    this.dataLinks = settingsData.dataLinks || [];
    this.annotations = {
      QueryEditor: OpenSearchAnnotationsQueryEditor,
    };

    if (this.logMessageField === '') {
      this.logMessageField = undefined;
    }

    if (this.logLevelField === '') {
      this.logLevelField = undefined;
    }
    this.pplEnabled = settingsData.pplEnabled ?? true;
    this.sigV4Auth = settingsData.sigV4Auth ?? false;
  }

  /**
   * Private method used in the `getSupplementaryRequest` for DataSourceWithSupplementaryQueriesSupport, specifically for Logs volume queries.
   * @returns A DataQueryRequest or undefined if no suitable queries are found.
   */
  private getLogsVolumeDataProvider(
    request: DataQueryRequest<OpenSearchQuery>
  ): DataQueryRequest<OpenSearchQuery> | undefined {
    const logsVolumeRequest = _.cloneDeep(request);
    const targets = logsVolumeRequest.targets
      .map((target) => this.getSupplementaryQuery({ type: SupplementaryQueryType.LogsVolume }, target))
      .filter((query): query is OpenSearchQuery => !!query);

    if (!targets.length) {
      return undefined;
    }

    return { ...logsVolumeRequest, targets };
  }

  getSupplementaryRequest(
    type: SupplementaryQueryType,
    request: DataQueryRequest<OpenSearchQuery>
  ): DataQueryRequest<OpenSearchQuery> | undefined {
    switch (type) {
      case SupplementaryQueryType.LogsVolume:
        return this.getLogsVolumeDataProvider(request);
      default:
        return undefined;
    }
  }

  /**
   * Implemented for DataSourceWithSupplementaryQueriesSupport.
   * It returns the supplementary types that the data source supports.
   * @returns An array of supported supplementary query types.
   */
  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[] {
    return [SupplementaryQueryType.LogsVolume];
  }

  /**
   * Implemented for DataSourceWithSupplementaryQueriesSupport.
   * It retrieves supplementary queries based on the provided options and ES query.
   * @returns A supplemented ES query or undefined if unsupported.
   */
  getSupplementaryQuery(options: SupplementaryQueryOptions, query: OpenSearchQuery): OpenSearchQuery | undefined {
    if (query.hide) {
      return undefined;
    }

    let isQuerySuitable = false;

    switch (options.type) {
      case SupplementaryQueryType.LogsVolume:
        // it has to be a logs-producing range-query
        isQuerySuitable = !!(query.metrics?.length === 1 && query.metrics[0].type === 'logs');
        if (!isQuerySuitable) {
          return undefined;
        }
        const bucketAggs: BucketAggregation[] = [];
        const timeField = this.timeField ?? '@timestamp';

        if (this.logLevelField) {
          bucketAggs.push({
            id: '2',
            type: 'terms',
            settings: {
              min_doc_count: '0',
              size: '0',
              order: 'desc',
              orderBy: '_count',
              missing: LogLevel.unknown,
            },
            field: this.logLevelField,
          });
        }
        bucketAggs.push({
          id: '3',
          type: 'date_histogram',
          settings: {
            interval: 'auto',
            min_doc_count: '0',
            trimEdges: '0',
          },
          field: timeField,
        });

        return {
          refId: `${REF_ID_STARTER_LOG_VOLUME}${query.refId}`,
          query: query.query,
          metrics: [{ type: 'count', id: '1' }],
          timeField,
          bucketAggs,
        };

      default:
        return undefined;
    }
  }

  /**
   * Sends a GET request to the specified url on the newest matching and available index.
   *
   * When multiple indices span the provided time range, the request is sent starting from the newest index,
   * and then going backwards until an index is found.
   *
   * @param url the url to query the index on, for example `/_mapping`.
   */
  private get(url: string, range = getDefaultTimeRange()) {
    const indexList = this.indexPattern.getIndexList(range.from, range.to);
    // @ts-ignore-next-line
    let requestObservable: Promise<any>;
    if (_.isArray(indexList) && indexList.length) {
      requestObservable = this.requestAllIndices(indexList, url);
    } else {
      const path = this.indexPattern.getIndexForToday() + url;
      requestObservable = this.getResourceRequest(path);
    }
    return requestObservable.then((results: any) => {
      let data = results;
      return data;
    });
  }

  private async requestAllIndices(indexList: string[], url: string): Promise<any> {
    const maxTraversals = 7; // do not go beyond one week (for a daily pattern)
    const listLen = indexList.length;
    for (let i = 0; i < Math.min(listLen, maxTraversals); i++) {
      const path = indexList[listLen - i - 1] + url;
      try {
        return await this.getResourceRequest(path);
      } catch (err) {
        // TODO: use `isFetchError` when using grafana9
        if ((err as FetchError).status !== 404 || i === maxTraversals - 1) {
          throw err;
        }
      }
    }
  }

  getResourceRequest(path: string, params?: BackendSrvRequest['params'], options?: Partial<BackendSrvRequest>) {
    return this.getResource(path, params, options);
  }

  async postResourceRequest(path: string, data?: BackendSrvRequest['data'], options?: Partial<BackendSrvRequest>) {
    const resourceOptions = options ?? {};
    resourceOptions.headers = resourceOptions.headers ?? {};
    resourceOptions.headers['content-type'] = 'application/x-ndjson';
    if (this.sigV4Auth && data) {
      resourceOptions.headers['x-amz-content-sha256'] = await sha256(data);
    }

    return this.postResource(path, JSON.stringify(data), resourceOptions);
  }

  annotationQuery(options: any): Promise<AnnotationEvent[]> {
    const payload = this.prepareAnnotationRequest(options);
    // TODO: make this a query instead of a resource request
    const annotationObservable = this.postResourceRequest('_msearch', payload);
    return annotationObservable.then(
      (res: any) => {
        const hits = res.responses[0].hits.hits ?? [];
        return this.processHitsToAnnotationEvents(options.annotation, hits);
      },
      (reason: any) => {
        throw new Error('Error querying annotations: ' + reason);
      }
    );
  }

  private prepareAnnotationRequest(options: { annotation: OpenSearchAnnotationQuery; range: TimeRange }) {
    const annotation = options.annotation;
    const timeField = annotation.timeField || '@timestamp';
    const timeEndField = annotation.timeEndField || null;
    const queryString = annotation.query || annotation.target.query;

    const dateRanges = [];
    const rangeStart: any = {};
    rangeStart[timeField] = {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      format: 'epoch_millis',
    };
    dateRanges.push({ range: rangeStart });

    if (timeEndField) {
      const rangeEnd: any = {};
      rangeEnd[timeEndField] = {
        from: options.range.from.valueOf(),
        to: options.range.to.valueOf(),
        format: 'epoch_millis',
      };
      dateRanges.push({ range: rangeEnd });
    }

    const queryInterpolated = getTemplateSrv().replace(queryString, {}, 'lucene');
    const query = {
      bool: {
        filter: [
          {
            bool: {
              should: dateRanges,
              minimum_should_match: 1,
            },
          },
          {
            query_string: {
              query: queryInterpolated,
            },
          },
        ],
      },
    };

    const data: any = {
      query,
      size: 10000,
    };

    // fields field are only supported in ES < 5.x
    if (this.flavor === Flavor.Elasticsearch && lt(this.version, '5.0.0')) {
      data.fields = [timeField, '_source'];
    }

    const header: any = {
      search_type: 'query_then_fetch',
      ignore_unavailable: true,
    };

    // old elastic annotations had index specified on them
    if (annotation.index) {
      header.index = annotation.index;
    } else {
      header.index = this.indexPattern.getIndexList(options.range.from, options.range.to);
    }

    return JSON.stringify(header) + '\n' + JSON.stringify(data) + '\n';
  }

  // Private method used in the `annotationQuery` to process Elasticsearch hits into AnnotationEvents
  private processHitsToAnnotationEvents(annotation: OpenSearchAnnotationQuery, hits: Array<{ [key: string]: any }>) {
    const timeField = annotation.timeField || '@timestamp';
    const timeEndField = annotation.timeEndField || null;
    const tagsField = annotation.tagsField || 'tags';
    const textField = annotation.textField || null;
    const list: AnnotationEvent[] = [];
    const getFieldFromSource = (source: any, fieldName: any) => {
      if (!fieldName) {
        return;
      }

      const fieldNames = fieldName.split('.');
      let fieldValue = source;

      for (let i = 0; i < fieldNames.length; i++) {
        fieldValue = fieldValue[fieldNames[i]];
        if (!fieldValue) {
          console.log('could not find field in annotation: ', fieldName);
          return '';
        }
      }

      return fieldValue;
    };

    for (let i = 0; i < hits.length; i++) {
      const source = hits[i]._source;
      let time = getFieldFromSource(source, timeField);
      if (typeof hits[i].fields !== 'undefined') {
        const fields = hits[i].fields;
        if (_.isString(fields[timeField]) || _.isNumber(fields[timeField])) {
          time = fields[timeField];
        }
      }

      const event: {
        annotation: any;
        time: number;
        timeEnd?: number;
        text: string;
        tags?: string[];
      } = {
        annotation: annotation,
        time: toUtc(time).valueOf(),
        text: getFieldFromSource(source, textField),
      };

      if (timeEndField) {
        const timeEnd = getFieldFromSource(source, timeEndField);
        if (timeEnd) {
          event.timeEnd = toUtc(timeEnd).valueOf();
        }
      }

      // legacy support for title field
      if (annotation.titleField) {
        const title = getFieldFromSource(source, annotation.titleField);
        if (title) {
          event.text = title + '\n' + event.text;
        }
      }

      let tags = getFieldFromSource(source, tagsField);
      if (typeof tags === 'string') {
        tags = tags.split(',');
      }
      event.tags = tags;

      list.push(event);
    }
    return list;
  }

  // called when an ad hoc filter is added in Explore
  toggleQueryFilter(query: OpenSearchQuery, filter: ToggleFilterAction): OpenSearchQuery {
    if (query.queryType === QueryType.Lucene) {
      return { ...query, query: toggleQueryFilterForLucene(query.query || '', filter) };
    } else {
      return { ...query, query: toggleQueryFilterForPPL(query.query || '', filter) };
    }
  }

  queryHasFilter(query: OpenSearchQuery, options: QueryFilterOptions): boolean {
    if (query.queryType === QueryType.PPL) {
      const adHocFilter: AdHocVariableFilter = {
        key: options.key,
        value: options.value,
        // explore ad hoc filters only have equality operators
        operator: options.type === 'FILTER_FOR' ? '=' : '!=',
      };
      return PPLQueryHasFilter(query.query || '', adHocFilter);
    } else {
      return luceneQueryHasFilter(query.query || '', options.key, options.value);
    }
  }

  private interpolateLuceneQuery(queryString: string, scopedVars: ScopedVars) {
    return this.templateSrv.replace(queryString, scopedVars, 'lucene');
  }

  private interpolatePPLQuery(queryString: string, scopedVars: ScopedVars) {
    return this.templateSrv.replace(queryString, scopedVars, 'pipe');
  }

  // called from Explore
  interpolateVariablesInQueries(
    queries: OpenSearchQuery[],
    scopedVars: ScopedVars | {},
    filters?: AdHocVariableFilter[]
  ): OpenSearchQuery[] {
    return queries.map((q) => this.applyTemplateVariables(q, scopedVars, filters));
  }

  applyTemplateVariables(
    query: OpenSearchQuery,
    scopedVars: ScopedVars,
    adHocFilters?: AdHocVariableFilter[]
  ): OpenSearchQuery {
    let interpolatedQuery: string;
    if (query.queryType === QueryType.PPL) {
      interpolatedQuery = this.interpolatePPLQuery(query.query || '', scopedVars);
    } else {
      interpolatedQuery = this.interpolateLuceneQuery(query.query || '*', scopedVars);
    }
    // We need a separate interpolation format for lucene queries, therefore we first interpolate any
    // lucene query string and then everything else
    for (let bucketAgg of query.bucketAggs || []) {
      if (bucketAgg.type === 'filters') {
        for (let filter of bucketAgg.settings?.filters || []) {
          filter.query = this.interpolateLuceneQuery(filter.query, scopedVars) || '*';
        }
      }
    }

    const queryWithAppliedAdHocFilters = adHocFilters?.length
      ? this.addAdHocFilters({ ...query, query: interpolatedQuery }, adHocFilters)
      : interpolatedQuery;

    // interpolate any nested fields (interval etc.)
    const finalQuery = JSON.parse(
      this.templateSrv.replace(JSON.stringify({ ...query, query: queryWithAppliedAdHocFilters }), scopedVars)
    );
    return finalQuery;
  }

  addAdHocFilters(target: OpenSearchQuery, adHocFilters: AdHocVariableFilter[]): string {
    if (target.queryType === QueryType.PPL) {
      let finalQuery: string = target.query || '';
      adHocFilters.forEach((filter, i) => {
        finalQuery = addAdhocFilterToPPLQuery(finalQuery, filter, i);
      });
      return finalQuery;
    }
    let finalQuery: string = target.query ?? '';
    adHocFilters.forEach((filter) => {
      finalQuery = addLuceneAdHocFilter(finalQuery, filter);
    });
    return finalQuery || '*';
  }

  testDatasource() {
    // @ts-ignore-next-line
    // TODO: run through backend health check

    if (!this.flavor || !valid(this.version)) {
      return Promise.reject({
        status: 'error',
        message: 'No version set',
        error: new HealthCheckError('No version set', {}),
      });
    }

    // validate that the index exist and has date field
    // TODO this doesn't work with many indices have different date field names
    return this.getFields('date').then(
      (dateFields: any) => {
        const timeField: any = _.find(dateFields, { text: this.timeField });
        if (!timeField) {
          return {
            status: 'success',
            message: 'Index OK. Note: No date field named ' + this.timeField + ' found',
          };
        }
        return { status: 'success', message: 'Index OK. Time field name OK.' };
      },
      (err: any) => {
        if (err.message) {
          return Promise.reject({
            status: 'error',
            message: err.message,
            error: new HealthCheckError(err.message, {}),
          });
        } else if (err.data.message) {
          return Promise.reject({
            status: 'error',
            message: err.data.message,
            error: new HealthCheckError(err.data.message, {}),
          });
        } else {
          return Promise.reject({ status: 'error', message: err.status, error: new HealthCheckError(err.status, {}) });
        }
      }
    );
  }

  getQueryHeader(searchType: any, timeFrom: any, timeTo: any) {
    const queryHeader: any = {
      search_type: searchType,
      ignore_unavailable: true,
      index: this.indexPattern.getIndexList(timeFrom, timeTo),
    };

    if (this.flavor === Flavor.Elasticsearch && satisfies(this.version, '>=5.6.0 <7.0.0')) {
      queryHeader['max_concurrent_shard_requests'] = this.maxConcurrentShardRequests;
    }

    return JSON.stringify(queryHeader);
  }

  getQueryDisplayText(query: OpenSearchQuery) {
    // TODO: This might be refactored a bit.
    const metricAggs = query.metrics;
    const bucketAggs = query.bucketAggs;
    let text = '';

    if (query.query) {
      text += 'Query: ' + query.query + ', ';
    }

    text += 'Metrics: ';

    text += metricAggs?.reduce((acc, metric) => {
      const metricConfig = metricAggregationConfig[metric.type];

      let text = metricConfig.label + '(';

      if (isMetricAggregationWithField(metric)) {
        text += metric.field;
      }
      if (isPipelineAggregationWithMultipleBucketPaths(metric)) {
        text += metric.settings?.script?.replace(new RegExp('params.', 'g'), '');
      }
      text += '), ';

      return `${acc} ${text}`;
    }, '');

    text += bucketAggs?.reduce((acc, bucketAgg, index) => {
      const bucketConfig = bucketAggregationConfig[bucketAgg.type];

      let text = '';
      if (index === 0) {
        text += ' Group by: ';
      }

      text += bucketConfig.label + '(';
      if (isBucketAggregationWithField(bucketAgg)) {
        text += bucketAgg.field;
      }

      return `${acc} ${text}), `;
    }, '');

    if (query.alias) {
      text += 'Alias: ' + query.alias;
    }

    return text;
  }

  query(request: DataQueryRequest<OpenSearchQuery>): Observable<DataQueryResponse> {
    console.log('[OpenSearchDatasource] query', request);

    if (request.liveStreaming && !this.isHandlingLiveStreaming) {
      console.log('[OpenSearchDatasource] live streaming');
      try {
        this.isHandlingLiveStreaming = true;
        return this.runLiveQueryThroughBackend(request);
      } finally {
        this.isHandlingLiveStreaming = false;
      }
    }

    return super.query(request).pipe(
      tap({
        next: (response) => {
          trackQuery(response, request.targets, request.app);
        },
        error: (error) => {
          trackQuery({ error, data: [] }, request.targets, request.app);
        },
      }),
      map((response) => {
        return enhanceDataFramesWithDataLinks(response, this.dataLinks, this.uid, this.name, this.type);
      })
    );
  }

  runLiveQueryThroughBackend(request: DataQueryRequest<OpenSearchQuery>): Observable<DataQueryResponse> {
    const liveQueries = request.targets.filter((query) => {
      return query.metrics?.length === 1 && query.metrics[0].type === 'logs' && !query.hide;
    });

    if (liveQueries.length === 0) {
      console.log('[OpenSearch runLiveQueryThroughBackend] No live stream-able queries found.');
      return of({ data: [], state: LoadingState.Done, key: request.requestId });
    }

    const firstLiveQuery = liveQueries[0];
    if (!firstLiveQuery) {
      return of({ data: [], state: LoadingState.Done, key: request.requestId });
    }

    const { format, ...streamingQueryPayload } = firstLiveQuery;
    const finalStreamingQuery = {
      ...streamingQueryPayload,
      query: streamingQueryPayload.query || '*',
      refId: firstLiveQuery.refId,
    };

    const streamPath = `tail/${firstLiveQuery.refId}`;
    const registerQueryPath = `_stream_query_register/${firstLiveQuery.refId}`;

    console.log(
      `[OpenSearch runLiveQueryThroughBackend] Registering query for path: ${registerQueryPath} with query:`,
      finalStreamingQuery
    );

    return from(
      this.postResourceRequest(registerQueryPath, finalStreamingQuery, {
        headers: { 'Content-Type': 'application/json' },
      })
    ).pipe(
      mergeMap(() => {
        console.log(
          `[OpenSearch runLiveQueryThroughBackend] Query registered. Setting up Grafana Live stream for path: ${streamPath}`
        );

        const liveService = getGrafanaLiveSrv();
        if (!liveService) {
          console.error('[OpenSearch runLiveQueryThroughBackend] Grafana Live service not available.');
          return of({
            data: [],
            state: LoadingState.Error,
            error: { message: 'Grafana Live service not available' },
            key: request.requestId,
          });
        }

        return liveService
          .getDataStream({
            addr: {
              scope: LiveChannelScope.DataSource,
              namespace: this.uid,
              path: streamPath,
            },
            key: `${request.requestId}-${firstLiveQuery.refId}`,
          })
          .pipe(
            tap({
              next: (response) => {
                const queryResponseForTracking: Partial<DataQueryResponse> = {
                  data: Array.isArray(response) ? response : (response as DataQueryResponse)?.data || [],
                };
                trackQuery(queryResponseForTracking as DataQueryResponse, [firstLiveQuery], request.app);
              },
              error: (error) => {
                console.error('[OpenSearch runLiveQueryThroughBackend] Error from Grafana Live stream:', error);
                trackQuery({ error, data: [] }, [firstLiveQuery], request.app);
              },
              complete: () => {
                console.log('[OpenSearch runLiveQueryThroughBackend] Grafana Live stream completed.');
              },
            }),
            map((response: DataQueryResponse | DataFrame[]) => {
              let dataFrames: DataFrame[];
              if (Array.isArray(response)) {
                dataFrames = response as DataFrame[];
              } else if (response.data) {
                dataFrames = response.data;
              } else {
                dataFrames = [];
              }
              const enhancedResponse: DataQueryResponse = {
                data: dataFrames,
                key: firstLiveQuery.refId || request.requestId,
                state: LoadingState.Streaming,
              };
              return enhanceDataFramesWithDataLinks(enhancedResponse, this.dataLinks, this.uid, this.name, this.type);
            })
          );
      })
    );
  }

  async getOpenSearchVersion(): Promise<Version> {
    return this.getResourceRequest('').then(
      (results: any) => {
        const newVersion: Version = {
          flavor: results.version.distribution === 'opensearch' ? Flavor.OpenSearch : Flavor.Elasticsearch,
          version: results.version.number,
        };
        newVersion.label = `${
          AVAILABLE_FLAVORS.find((f) => f.value === newVersion.flavor)?.label || newVersion.flavor
        } ${newVersion.version}`;

        // Elasticsearch versions after 7.10 are unsupported
        if (newVersion.flavor === Flavor.Elasticsearch && gte(newVersion.version, '7.11.0')) {
          throw new Error(
            'ElasticSearch version ' +
              newVersion.version +
              ` is not supported by the OpenSearch plugin. Use the ElasticSearch plugin.`
          );
        }

        // Handle an Opensearch instance in compatibility mode. They report ElasticSearch version 7.10.2 but they still use the OpenSearch tagline
        if (
          newVersion.flavor === Flavor.Elasticsearch &&
          newVersion.version === '7.10.2' &&
          results.tagline === 'The OpenSearch Project: https://opensearch.org/'
        ) {
          newVersion.flavor = Flavor.OpenSearch;
          newVersion.version = '1.0.0';
          newVersion.label = 'OpenSearch (compatibility mode)';
        }

        return newVersion;
      },
      () => {
        throw new Error('Failed to connect to server');
      }
    );
  }

  isMetadataField(fieldName: string) {
    return META_FIELDS.includes(fieldName);
  }

  // TODO: instead of being a string, this could be a custom type representing all the available types
  async getFields(type?: string, range?: TimeRange): Promise<MetricFindValue[]> {
    return this.get('/_mapping', range).then((result: any) => {
      const typeMap: any = {
        float: 'number',
        double: 'number',
        integer: 'number',
        long: 'number',
        date: 'date',
        date_nanos: 'date',
        string: 'string',
        text: 'string',
        scaled_float: 'number',
        nested: 'nested',
      };

      const shouldAddField = (obj: any, key: string) => {
        if (this.isMetadataField(key)) {
          return false;
        }

        if (!type) {
          return true;
        }

        // equal query type filter, or via typemap translation
        return type === obj.type || type === typeMap[obj.type];
      };

      // Store subfield names: [system, process, cpu, total] -> system.process.cpu.total
      const fieldNameParts: any = [];
      const fields: any = {};

      function getFieldsRecursively(obj: any) {
        for (const key in obj) {
          const subObj = obj[key];

          // Check mapping field for nested fields
          if (_.isObject(subObj.properties)) {
            fieldNameParts.push(key);
            getFieldsRecursively(subObj.properties);
          }

          if (_.isObject(subObj.fields)) {
            fieldNameParts.push(key);
            getFieldsRecursively(subObj.fields);
          }

          if (_.isString(subObj.type)) {
            const fieldName = fieldNameParts.concat(key).join('.');

            // Hide meta-fields and check field type
            if (shouldAddField(subObj, key)) {
              fields[fieldName] = {
                text: fieldName,
                type: subObj.type,
              };
            }
          }
        }
        fieldNameParts.pop();
      }

      for (const indexName in result) {
        const index = result[indexName];
        if (index && index.mappings) {
          const mappings = index.mappings;

          if (this.flavor === Flavor.Elasticsearch && lt(this.version, '7.0.0')) {
            for (const typeName in mappings) {
              getFieldsRecursively(mappings[typeName].properties);
            }
          } else {
            getFieldsRecursively(mappings.properties);
          }
        }
      }

      // transform to array
      return _.map(fields, (value) => {
        return value;
      });
    });
  }

  getTerms(queryDef: any, range = getDefaultTimeRange(), isTagValueQuery = false) {
    const searchType = this.flavor === Flavor.Elasticsearch && lt(this.version, '5.0.0') ? 'count' : 'query_then_fetch';
    const header = this.getQueryHeader(searchType, range.from, range.to);
    let esQuery = JSON.stringify(this.queryBuilder.getTermsQuery(queryDef));

    esQuery = esQuery.replace(/\$timeFrom/g, range.from.valueOf().toString());
    esQuery = esQuery.replace(/\$timeTo/g, range.to.valueOf().toString());
    esQuery = header + '\n' + esQuery + '\n';

    const url = this.getMultiSearchUrl();

    return this.postResourceRequest(url, esQuery).then((res: any) => {
      if (!res.responses[0].aggregations) {
        return [];
      }

      const buckets = res.responses[0].aggregations['1'].buckets;
      return _.map(buckets, (bucket) => {
        const keyString = String(bucket.key);
        return {
          text: bucket.key_as_string || keyString,
          value: isTagValueQuery ? keyString : bucket.key,
        };
      });
    });
  }

  getMultiSearchUrl() {
    if (
      this.maxConcurrentShardRequests &&
      // Setting max_concurrent_shard_requests in query params is supported in ES >= 7.0
      ((this.flavor === Flavor.Elasticsearch && gte(this.version, '7.0.0')) ||
        // And all OpenSearch versions
        this.flavor === Flavor.OpenSearch)
    ) {
      return `_msearch?max_concurrent_shard_requests=${this.maxConcurrentShardRequests}`;
    }

    return '_msearch';
  }

  getPPLUrl() {
    return '_opendistro/_ppl';
  }

  metricFindQuery(query: string, options?: any): Promise<MetricFindValue[]> {
    const range = options?.range;
    const parsedQuery = JSON.parse(query);
    if (query) {
      if (parsedQuery.find === 'fields') {
        parsedQuery.type = getTemplateSrv().replace(parsedQuery.type, {}, 'lucene');
        return this.getFields(parsedQuery.type, range);
      }

      if (parsedQuery.find === 'terms') {
        if (parsedQuery.field) {
          parsedQuery.field = getTemplateSrv().replace(parsedQuery.field, {}, 'lucene');
        }
        if (parsedQuery.script) {
          parsedQuery.script = getTemplateSrv().replace(parsedQuery.script);
        }
        parsedQuery.query = getTemplateSrv().replace(parsedQuery.query || '*', {}, 'lucene');
        return this.getTerms(parsedQuery, range);
      }
    }

    return Promise.resolve([]);
  }

  getTagKeys() {
    return this.getFields();
  }

  getTagValues(options: any) {
    return this.getTerms({ field: options.key, query: '*' }, options.timeRange, true);
  }

  targetContainsTemplate(target: any) {
    // @ts-ignore
    if (getTemplateSrv().variableExists(target.query) || getTemplateSrv().variableExists(target.alias)) {
      return true;
    }

    for (const bucketAgg of target.bucketAggs) {
      // @ts-ignore
      if (getTemplateSrv().variableExists(bucketAgg.field) || this.objectContainsTemplate(bucketAgg.settings)) {
        return true;
      }
    }

    for (const metric of target.metrics) {
      if (
        // @ts-ignore
        getTemplateSrv().variableExists(metric.field) ||
        this.objectContainsTemplate(metric.settings) ||
        this.objectContainsTemplate(metric.meta)
      ) {
        return true;
      }
    }

    return false;
  }

  private isPrimitive(obj: any) {
    if (obj === null || obj === undefined) {
      return true;
    }
    if (['string', 'number', 'boolean'].some((type) => type === typeof true)) {
      return true;
    }

    return false;
  }

  private objectContainsTemplate(obj: any) {
    if (!obj) {
      return false;
    }

    for (const key of Object.keys(obj)) {
      if (this.isPrimitive(obj[key])) {
        // @ts-ignore
        if (getTemplateSrv().variableExists(obj[key])) {
          return true;
        }
      } else if (Array.isArray(obj[key])) {
        for (const item of obj[key]) {
          if (this.objectContainsTemplate(item)) {
            return true;
          }
        }
      } else {
        if (this.objectContainsTemplate(obj[key])) {
          return true;
        }
      }
    }

    return false;
  }

  getSupportedQueryTypes(): QueryType[] {
    return [QueryType.Lucene, ...(this.pplEnabled ? [QueryType.PPL] : [])];
  }
}

/**
 * Modifies dataframe and adds dataLinks from the config.
 * Exported for tests.
 */
export function enhanceDataFrame(dataFrame: DataFrame, dataLinks: DataLinkConfig[]) {
  const dataSourceSrv = getDataSourceSrv();

  if (!dataLinks.length) {
    return;
  }

  for (const field of dataFrame.fields) {
    const dataLinkConfig = dataLinks.find((dataLink) => field.name && field.name.match(dataLink.field));

    if (!dataLinkConfig) {
      continue;
    }

    let link: DataLink;

    if (dataLinkConfig.datasourceUid) {
      // @ts-ignore
      const dsSettings = dataSourceSrv.getInstanceSettings(dataLinkConfig.datasourceUid);

      link = {
        title: '',
        url: '',
        internal: {
          query: { query: dataLinkConfig.url },
          datasourceUid: dataLinkConfig.datasourceUid,
          // @ts-ignore
          datasourceName: dsSettings?.name ?? 'Data source not found',
        },
      };
    } else {
      link = {
        title: '',
        url: dataLinkConfig.url,
      };
    }

    field.config = field.config || {};
    field.config.links = [...(field.config.links || []), link];
  }
}
