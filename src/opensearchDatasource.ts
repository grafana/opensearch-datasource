import _ from 'lodash';
import { from, merge, of, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  DataSourceInstanceSettings,
  DataQueryRequest,
  DataQueryResponse,
  DataFrame,
  ScopedVars,
  DataLink,
  MetricFindValue,
  dateTime,
  TimeRange,
  LoadingState,
  toUtc,
  getDefaultTimeRange,
  ToggleFilterAction,
  QueryFilterOptions,
  AdHocVariableFilter,
  CoreApp,
} from '@grafana/data';
import { OpenSearchResponse } from './OpenSearchResponse';
import { IndexPattern } from './index_pattern';
import { QueryBuilder } from './QueryBuilder';
import { defaultBucketAgg, hasMetricOfType } from './query_def';
import {
  BackendSrvRequest,
  DataSourceWithBackend,
  FetchError,
  TemplateSrv,
  config,
  getBackendSrv,
  getDataSourceSrv,
  getTemplateSrv,
} from '@grafana/runtime';
import { DataLinkConfig, Flavor, LuceneQueryType, OpenSearchOptions, OpenSearchQuery, QueryType } from './types';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';
import {
  isMetricAggregationWithField,
  isPipelineAggregationWithMultipleBucketPaths,
} from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { bucketAggregationConfig } from './components/QueryEditor/BucketAggregationsEditor/utils';
import { isBucketAggregationWithField } from './components/QueryEditor/BucketAggregationsEditor/aggregations';
import { gte, lt, satisfies, valid } from 'semver';
import { OpenSearchAnnotationsQueryEditor } from './components/QueryEditor/AnnotationQueryEditor';
import { trackQuery } from 'tracking';
import { enhanceDataFramesWithDataLinks, sha256 } from 'utils';
import { AVAILABLE_FLAVORS, Version } from 'configuration/utils';
import { createTraceDataFrame, createListTracesDataFrame } from 'traces/formatTraces';
import { createLuceneTraceQuery, getTraceIdFromLuceneQueryString } from 'traces/queryTraces';
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

export class OpenSearchDatasource extends DataSourceWithBackend<OpenSearchQuery, OpenSearchOptions> {
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

  private async request(method: string, url: string, data?: undefined, headers?: BackendSrvRequest['headers']) {
    const options: BackendSrvRequest = {
      url: this.url + '/' + url,
      method,
      data,
    };
    options.headers = headers ?? {};

    if (this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }

    if (this.basicAuth) {
      options.headers.Authorization = this.basicAuth;
    }

    if (this.sigV4Auth && data) {
      options.headers['x-amz-content-sha256'] = await sha256(data);
    }

    return getBackendSrv()
      .datasourceRequest(options)
      .catch((err: any) => {
        if (err.data) {
          const message = err.data.error?.reason ?? err.data.message ?? 'Unknown error';

          let newErr = new Error('OpenSearch error: ' + message);
          throw newErr;
        }
        throw err;
      });
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
    if (_.isArray(indexList) && indexList.length) {
      return this.requestAllIndices(indexList, url).then((results: any) => {
        results.data.$$config = results.config;
        return results.data;
      });
    } else {
      return this.request('GET', this.indexPattern.getIndexForToday() + url).then((results: any) => {
        results.data.$$config = results.config;
        return results.data;
      });
    }
  }

  private async requestAllIndices(indexList: string[], url: string): Promise<any> {
    const maxTraversals = 7; // do not go beyond one week (for a daily pattern)
    const listLen = indexList.length;
    for (let i = 0; i < Math.min(listLen, maxTraversals); i++) {
      try {
        return await this.request('GET', indexList[listLen - i - 1] + url);
      } catch (err) {
        // TODO: use `isFetchError` when using grafana9
        if ((err as FetchError).status !== 404 || i === maxTraversals - 1) {
          throw err;
        }
      }
    }
  }

  private postMultiSearch(url: string, data: any) {
    return this.post(url, data, { 'Content-Type': 'application/x-ndjson' });
  }

  private post(url: string, data: any, headers?: BackendSrvRequest['headers']) {
    return this.request('POST', url, data, headers).then((results: any) => {
      results.data.$$config = results.config;
      return results.data;
    });
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

    return this.postResource(path, data, resourceOptions);
  }

  annotationQuery(options: any): Promise<any> {
    const annotation = options.annotation;
    const timeField = annotation.timeField || '@timestamp';
    const timeEndField = annotation.timeEndField || null;
    const queryString = annotation.query || annotation.target.query;
    const tagsField = annotation.tagsField || 'tags';
    const textField = annotation.textField || null;

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

    const payload = JSON.stringify(header) + '\n' + JSON.stringify(data) + '\n';

    return this.postMultiSearch('_msearch', payload).then((res: any) => {
      const list = [];
      const hits = res.responses[0].hits.hits;

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
          tags: string | string[];
        } = {
          annotation: annotation,
          time: toUtc(time).valueOf(),
          text: getFieldFromSource(source, textField),
          tags: getFieldFromSource(source, tagsField),
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

        if (typeof event.tags === 'string') {
          event.tags = event.tags.split(',');
        }

        list.push(event);
      }
      return list;
    });
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
    if (!this.flavor || !valid(this.version)) {
      return Promise.resolve({
        status: 'error',
        message: 'No version set',
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
        console.error(err);
        if (err.message) {
          return { status: 'error', message: err.message };
        } else {
          return { status: 'error', message: err.status };
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
    // @ts-ignore-next-line
    const { openSearchBackendFlowEnabled } = config.featureToggles;
    const hasServiceMapQuery = request.targets.some((target) => target.serviceMap);
    // Backend flow
    if (request.app === CoreApp.Explore || openSearchBackendFlowEnabled || hasServiceMapQuery) {
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

    // Frontend flow
    const targetsWithInterpolatedVariables = request.targets.map((target) => {
      if (target.queryType === QueryType.PPL) {
        return {
          ...target,
          query: this.templateSrv.replace(target.query, request.scopedVars, 'pipe'),
        };
      } else {
        return {
          ...target,
          query: this.templateSrv.replace(target.query, request.scopedVars, 'lucene') || '*',
        };
      }
    });

    const luceneTargets: OpenSearchQuery[] = [];
    const pplTargets: OpenSearchQuery[] = [];
    for (const target of targetsWithInterpolatedVariables) {
      if (target.hide) {
        continue;
      }

      switch (target.queryType) {
        case QueryType.PPL:
          pplTargets.push(target);
          break;
        case QueryType.Lucene:
        default:
          luceneTargets.push(target);
      }
    }

    const subQueries: Array<Observable<DataQueryResponse>> = [];

    if (luceneTargets.length) {
      const luceneResponses = this.executeLuceneQueries(luceneTargets, request);
      subQueries.push(luceneResponses);
    }
    if (pplTargets.length) {
      const pplResponses = this.executePPLQueries(pplTargets, request);
      subQueries.push(pplResponses);
    }
    if (subQueries.length === 0) {
      return of({
        data: [],
        state: LoadingState.Done,
      });
    }
    return merge(...subQueries).pipe(
      tap({
        next: (response) => {
          trackQuery(response, [...pplTargets, ...luceneTargets], request.app);
        },
        error: (error) => {
          trackQuery({ error, data: [] }, [...pplTargets, ...luceneTargets], request.app);
        },
      })
    );
  }

  /**
   * Execute all Lucene queries. Returns an Observable to be merged.
   */
  private executeLuceneQueries(
    targets: OpenSearchQuery[],
    options: DataQueryRequest<OpenSearchQuery>
  ): Observable<DataQueryResponse> {
    const createQuery = (ts: OpenSearchQuery[]) => {
      let payload = '';

      for (const target of ts) {
        payload += this.createLuceneQuery(target, options);
      }

      // We replace the range here for actual values. We need to replace it together with enclosing "" so that we replace
      // it as an integer not as string with digits. This is because elastic will convert the string only if the time
      // field is specified as type date (which probably should) but can also be specified as integer (millisecond epoch)
      // and then sending string will error out.
      payload = payload.replace(/"\$timeFrom"/g, options.range.from.valueOf().toString());
      payload = payload.replace(/"\$timeTo"/g, options.range.to.valueOf().toString());
      payload = getTemplateSrv().replace(payload, options.scopedVars);

      return payload;
    };

    const traceListTargets = targets.filter(
      (target) =>
        target.luceneQueryType === LuceneQueryType.Traces && !getTraceIdFromLuceneQueryString(target.query || '')
    );
    const traceTargets = targets.filter(
      (target) =>
        target.luceneQueryType === LuceneQueryType.Traces && getTraceIdFromLuceneQueryString(target.query || '')
    );

    const otherTargets = targets.filter((target) => target.luceneQueryType !== LuceneQueryType.Traces);

    const traceList$ =
      traceListTargets.length > 0
        ? from(this.postMultiSearch(this.getMultiSearchUrl(), createQuery(traceListTargets))).pipe(
            map((res: any) => {
              return createListTracesDataFrame(traceListTargets, res, this.uid, this.name, this.type);
            })
          )
        : null;

    const traceDetails$ =
      traceTargets.length > 0
        ? from(this.postMultiSearch(this.getMultiSearchUrl(), createQuery(traceTargets))).pipe(
            map((res: any) => {
              return createTraceDataFrame(traceTargets, res);
            })
          )
        : null;
    const otherQueries$ =
      otherTargets.length > 0
        ? from(this.postMultiSearch(this.getMultiSearchUrl(), createQuery(otherTargets))).pipe(
            map((res: any) => {
              const er = new OpenSearchResponse(otherTargets, res);
              // this condition that checks if some targets are logs, and if some are, enhance ALL data frames, even the ones that aren't
              // this was here before and I don't want to mess around with it right now
              if (otherTargets.some((target) => target.isLogsQuery)) {
                const response = er.getLogs(this.logMessageField, this.logLevelField);
                for (const dataFrame of response.data) {
                  enhanceDataFrame(dataFrame, this.dataLinks);
                }
                return response;
              }
              return er.getTimeSeries();
            })
          )
        : null;
    const observableArray = [traceList$, traceDetails$, otherQueries$].flatMap((obs) => (obs !== null ? obs : []));
    return merge(...observableArray);
  }

  /**
   * Execute all PPL queries. Returns an Observable to be merged.
   */
  private executePPLQueries(
    targets: OpenSearchQuery[],
    options: DataQueryRequest<OpenSearchQuery>
  ): Observable<DataQueryResponse> {
    const subQueries: Array<Observable<DataQueryResponse>> = [];

    for (const target of targets) {
      let payload = this.createPPLQuery(target, options);

      const rangeFrom = dateTime(options.range.from.valueOf()).utc().format('YYYY-MM-DD HH:mm:ss');
      const rangeTo = dateTime(options.range.to.valueOf()).utc().format('YYYY-MM-DD HH:mm:ss');
      // Replace the range here for actual values.
      payload = payload.replace(/\$timeTo/g, rangeTo);
      payload = payload.replace(/\$timeFrom/g, rangeFrom);
      payload = payload.replace(/\$timestamp/g, `\`${this.timeField}\``);
      subQueries.push(
        from(this.post(this.getPPLUrl(), payload)).pipe(
          map((res: any) => {
            const er = new OpenSearchResponse([target], res, QueryType.PPL);

            if (targets.some((target) => target.isLogsQuery)) {
              const response = er.getLogs(this.logMessageField, this.logLevelField);
              for (const dataFrame of response.data) {
                enhanceDataFrame(dataFrame, this.dataLinks);
              }
              return response;
            } else if (targets.some((target) => target.format === 'table')) {
              return er.getTable();
            }
            return er.getTimeSeries();
          })
        )
      );
    }
    return merge(...subQueries);
  }

  /**
   * Creates the payload string for a Lucene query
   */
  private createLuceneQuery(target: OpenSearchQuery, options: DataQueryRequest<OpenSearchQuery>): string {
    let queryString = getTemplateSrv().replace(target.query, options.scopedVars, 'lucene');
    // @ts-ignore
    // add global adhoc filters to timeFilter
    const adhocFilters = getTemplateSrv().getAdhocFilters(this.name);

    let queryObj;
    if (target.luceneQueryType === LuceneQueryType.Traces) {
      const luceneQuery = target.query || '';
      queryObj = createLuceneTraceQuery(luceneQuery);
    } else if (target.isLogsQuery || hasMetricOfType(target, 'logs')) {
      target.bucketAggs = [defaultBucketAgg()];
      target.metrics = [];
      // Setting this for metrics queries that are typed as logs
      target.isLogsQuery = true;
      queryObj = this.queryBuilder.getLogsQuery(target, adhocFilters, queryString);
    } else {
      if (target.alias) {
        target.alias = getTemplateSrv().replace(target.alias, options.scopedVars, 'lucene');
      }
      queryObj = this.queryBuilder.build(target, adhocFilters, queryString);
    }

    const esQuery = JSON.stringify(queryObj);
    const searchType =
      queryObj.size === 0 && lt(this.version, '5.0.0') && this.flavor === Flavor.Elasticsearch
        ? 'count'
        : 'query_then_fetch';
    const header = this.getQueryHeader(searchType, options.range.from, options.range.to);
    return header + '\n' + esQuery + '\n';
  }

  /**
   * Creates the payload string for a PPL query
   */
  private createPPLQuery(target: OpenSearchQuery, options: DataQueryRequest<OpenSearchQuery>): string {
    let queryString = getTemplateSrv().replace(target.query, options.scopedVars, 'pipe');
    let queryObj;

    // @ts-ignore
    // add global adhoc filters to timeFilter
    const adhocFilters = getTemplateSrv().getAdhocFilters(this.name);

    // PPL queryString should always be 'source=indexName' if empty string
    if (!queryString) {
      queryString = `source=\`${this.indexPattern.getPPLIndexPattern()}\``;
    }

    queryObj = this.queryBuilder.buildPPLQuery(target, adhocFilters, queryString);
    return JSON.stringify(queryObj);
  }

  async getOpenSearchVersion(): Promise<Version> {
    // @ts-ignore-next-line
    const { openSearchBackendFlowEnabled } = config.featureToggles;
    const getDbVersionObservable = openSearchBackendFlowEnabled
      ? this.getResourceRequest('')
      : this.request('GET', '/');
    return getDbVersionObservable.then(
      (results: any) => {
        const data = openSearchBackendFlowEnabled ? results : results.data;
        const newVersion: Version = {
          flavor: data.version.distribution === 'opensearch' ? Flavor.OpenSearch : Flavor.Elasticsearch,
          version: data.version.number,
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
          data.tagline === 'The OpenSearch Project: https://opensearch.org/'
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

  getTerms(queryDef: any, range = getDefaultTimeRange()) {
    const searchType = this.flavor === Flavor.Elasticsearch && lt(this.version, '5.0.0') ? 'count' : 'query_then_fetch';
    const header = this.getQueryHeader(searchType, range.from, range.to);
    let esQuery = JSON.stringify(this.queryBuilder.getTermsQuery(queryDef));

    esQuery = esQuery.replace(/\$timeFrom/g, range.from.valueOf().toString());
    esQuery = esQuery.replace(/\$timeTo/g, range.to.valueOf().toString());
    esQuery = header + '\n' + esQuery + '\n';

    const url = this.getMultiSearchUrl();

    // @ts-ignore-next-line
    const { openSearchBackendFlowEnabled } = config.featureToggles;
    const termsPromise = openSearchBackendFlowEnabled
      ? this.postResourceRequest(url, esQuery)
      : this.postMultiSearch(url, esQuery);

    return termsPromise.then((res: any) => {
      if (!res.responses[0].aggregations) {
        return [];
      }

      const buckets = res.responses[0].aggregations['1'].buckets;
      return _.map(buckets, (bucket) => {
        return {
          text: bucket.key_as_string || bucket.key,
          value: bucket.key,
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
    return this.getTerms({ field: options.key, query: '*' }, options.timeRange);
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
