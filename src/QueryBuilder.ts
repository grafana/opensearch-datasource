import { dateTime, dateMath } from '@grafana/data';
import { gte, lt } from 'semver';
import {
  Filters,
  Histogram,
  DateHistogram,
  Terms,
} from './components/QueryEditor/BucketAggregationsEditor/aggregations';
import {
  isMetricAggregationWithField,
  isMetricAggregationWithSettings,
  isPipelineAggregation,
  isPipelineAggregationWithMultipleBucketPaths,
} from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { defaultBucketAgg, defaultMetricAgg, defaultPPLFormat, findMetricById } from './query_def';
import { Flavor, OpenSearchQuery, QueryType } from './types';

export class QueryBuilder {
  timeField: string;
  version: string;
  flavor: Flavor;

  constructor(options: { timeField: string; version: string; flavor: Flavor }) {
    this.timeField = options.timeField;
    this.version = options.version;
    this.flavor = options.flavor;
  }

  getRangeFilter() {
    const filter: any = {};
    filter[this.timeField] = {
      gte: '$timeFrom',
      lte: '$timeTo',
      format: 'epoch_millis',
    };

    return filter;
  }

  buildTermsAgg(aggDef: Terms, queryNode: { terms?: any; aggs?: any }, target: OpenSearchQuery) {
    let metricRef;
    queryNode.terms = { field: aggDef.field };

    if (!aggDef.settings) {
      return queryNode;
    }

    // TODO: This default should be somewhere else together with the one used in the UI
    const size = aggDef.settings?.size ? parseInt(aggDef.settings.size, 10) : 500;
    queryNode.terms.size = size === 0 ? 500 : size;

    if (aggDef.settings.orderBy !== void 0) {
      queryNode.terms.order = {};
      if (
        aggDef.settings.orderBy === '_term' &&
        // Elasticsearch >= 6.0.0
        ((this.flavor === Flavor.Elasticsearch && gte(this.version, '6.0.0')) ||
          // Or OpenSearch
          this.flavor === Flavor.OpenSearch)
      ) {
        queryNode.terms.order['_key'] = aggDef.settings.order;
      } else {
        queryNode.terms.order[aggDef.settings.orderBy] = aggDef.settings.order;
      }

      // if metric ref, look it up and add it to this agg level
      metricRef = parseInt(aggDef.settings.orderBy, 10);
      if (!isNaN(metricRef)) {
        for (let metric of target.metrics || []) {
          if (metric.id === aggDef.settings.orderBy) {
            queryNode.aggs = {};
            queryNode.aggs[metric.id] = {};
            if (isMetricAggregationWithField(metric)) {
              queryNode.aggs[metric.id][metric.type] = { field: metric.field };
            }
            break;
          }
        }
      }
    }

    if (aggDef.settings.min_doc_count !== void 0) {
      queryNode.terms.min_doc_count = parseInt(aggDef.settings.min_doc_count, 10);

      if (isNaN(queryNode.terms.min_doc_count)) {
        queryNode.terms.min_doc_count = aggDef.settings.min_doc_count;
      }
    }

    if (aggDef.settings.missing) {
      queryNode.terms.missing = aggDef.settings.missing;
    }

    return queryNode;
  }

  getDateHistogramAgg(aggDef: DateHistogram) {
    const esAgg: any = {};
    const settings = aggDef.settings || {};
    esAgg.interval = settings.interval;
    esAgg.field = this.timeField;
    esAgg.min_doc_count = settings.min_doc_count || 0;
    esAgg.extended_bounds = { min: '$timeFrom', max: '$timeTo' };
    esAgg.format = 'epoch_millis';

    if (settings.offset !== '') {
      esAgg.offset = settings.offset;
    }

    if (esAgg.interval === 'auto') {
      esAgg.interval = '$__interval';
    }

    return esAgg;
  }

  getHistogramAgg(aggDef: Histogram) {
    const esAgg: any = {};
    const settings = aggDef.settings || {};
    esAgg.interval = settings.interval;
    esAgg.field = aggDef.field;
    esAgg.min_doc_count = settings.min_doc_count || 0;

    return esAgg;
  }

  getFiltersAgg(aggDef: Filters) {
    const filterObj: Record<string, { query_string: { query: string; analyze_wildcard: boolean } }> = {};

    for (let { query, label } of aggDef.settings?.filters || []) {
      filterObj[label || query] = {
        query_string: {
          query: query,
          analyze_wildcard: true,
        },
      };
    }

    return filterObj;
  }

  documentQuery(query: any, size: number, order: string, useTimeRange = true) {
    query.size = size;

    if (useTimeRange) {
      query.sort = {};
      query.sort[this.timeField] = { order: order, unmapped_type: 'boolean' };
    }

    // fields field are not supported starting from Elasticsearch 5.x
    if (this.flavor === Flavor.Elasticsearch && lt(this.version, '5.0.0')) {
      query.fields = ['*', '_source'];
    }

    query.script_fields = {};
    return query;
  }

  addAdhocFilters(query: any, adhocFilters: any) {
    if (!adhocFilters) {
      return;
    }

    let i, filter, condition: any, queryCondition: any;

    for (i = 0; i < adhocFilters.length; i++) {
      filter = adhocFilters[i];
      condition = {};
      condition[filter.key] = filter.value;
      queryCondition = {};
      queryCondition[filter.key] = { query: filter.value };

      switch (filter.operator) {
        case '=':
          if (!query.query.bool.must) {
            query.query.bool.must = [];
          }
          query.query.bool.must.push({ match_phrase: queryCondition });
          break;
        case '!=':
          if (!query.query.bool.must_not) {
            query.query.bool.must_not = [];
          }
          query.query.bool.must_not.push({ match_phrase: queryCondition });
          break;
        case '<':
          condition[filter.key] = { lt: filter.value };
          query.query.bool.filter.push({ range: condition });
          break;
        case '>':
          condition[filter.key] = { gt: filter.value };
          query.query.bool.filter.push({ range: condition });
          break;
        case '=~':
          query.query.bool.filter.push({ regexp: condition });
          break;
        case '!~':
          query.query.bool.filter.push({
            bool: { must_not: { regexp: condition } },
          });
          break;
      }
    }
  }

  build(target: OpenSearchQuery, adhocFilters?: any, queryString?: string) {
    // make sure query has defaults;
    target.metrics = target.metrics || [defaultMetricAgg()];
    target.bucketAggs = target.bucketAggs || [defaultBucketAgg()];
    target.timeField = this.timeField;
    target.queryType = QueryType.Lucene;

    let i, j, pv, nestedAggs, metric;
    const query = {
      size: 0,
      query: {
        bool: {
          filter: [
            { range: this.getRangeFilter() },
            {
              query_string: {
                analyze_wildcard: true,
                query: queryString,
              },
            },
          ],
        },
      },
    };

    this.addAdhocFilters(query, adhocFilters);

    // If target doesn't have bucketAggs and type is not raw_document, it is invalid query.
    if (target.bucketAggs.length === 0) {
      metric = target.metrics[0];

      if (!metric || !(metric.type === 'raw_document' || metric.type === 'raw_data')) {
        throw { message: 'Invalid query' };
      }
    }

    /* Handle document query:
     * Check if metric type is raw_document. If metric doesn't have size (or size is 0), update size to 500.
     * Otherwise it will not be a valid query and error will be thrown.
     */
    if (target.metrics?.[0]?.type === 'raw_document' || target.metrics?.[0]?.type === 'raw_data') {
      metric = target.metrics[0];

      // TODO: This default should be somewhere else together with the one used in the UI
      const size = metric.settings?.size ? parseInt(metric.settings.size, 10) : 500;
      const order = metric.settings?.order ? metric.settings.order : 'desc';
      const useTimeRange = metric.settings?.useTimeRange;

      if (!useTimeRange) {
        query.query.bool.filter.shift();
      }

      return this.documentQuery(query, size || 500, order, useTimeRange);
    }

    nestedAggs = query;

    for (i = 0; i < target.bucketAggs.length; i++) {
      const aggDef = target.bucketAggs[i];
      const esAgg: any = {};

      switch (aggDef.type) {
        case 'date_histogram': {
          esAgg['date_histogram'] = this.getDateHistogramAgg(aggDef);
          break;
        }
        case 'histogram': {
          esAgg['histogram'] = this.getHistogramAgg(aggDef);
          break;
        }
        case 'filters': {
          esAgg['filters'] = { filters: this.getFiltersAgg(aggDef) };
          break;
        }
        case 'terms': {
          this.buildTermsAgg(aggDef, esAgg, target);
          break;
        }
        case 'geohash_grid': {
          esAgg['geohash_grid'] = {
            field: aggDef.field,
            precision: aggDef.settings?.precision,
          };
          break;
        }
      }

      nestedAggs.aggs = nestedAggs.aggs || {};
      nestedAggs.aggs[aggDef.id] = esAgg;
      nestedAggs = esAgg;
    }

    nestedAggs.aggs = {};

    for (i = 0; i < target.metrics.length; i++) {
      metric = target.metrics[i];
      if (metric.type === 'count') {
        continue;
      }

      const aggField: any = {};
      let metricAgg: any = null;

      if (isPipelineAggregation(metric)) {
        if (isPipelineAggregationWithMultipleBucketPaths(metric)) {
          if (metric.pipelineVariables) {
            metricAgg = {
              buckets_path: {},
            };

            for (j = 0; j < metric.pipelineVariables.length; j++) {
              pv = metric.pipelineVariables[j];

              if (pv.name && pv.pipelineAgg && /^\d*$/.test(pv.pipelineAgg)) {
                const appliedAgg = findMetricById(target.metrics, pv.pipelineAgg);
                if (appliedAgg) {
                  if (appliedAgg.type === 'count') {
                    metricAgg.buckets_path[pv.name] = '_count';
                  } else {
                    metricAgg.buckets_path[pv.name] = pv.pipelineAgg;
                  }
                }
              }
            }
          } else {
            continue;
          }
        } else {
          if (metric.field && /^\d*$/.test(metric.field)) {
            const appliedAgg = findMetricById(target.metrics, metric.field);
            if (appliedAgg) {
              if (appliedAgg.type === 'count') {
                metricAgg = { buckets_path: '_count' };
              } else {
                metricAgg = { buckets_path: metric.field };
              }
            }
          } else {
            continue;
          }
        }
      } else if (isMetricAggregationWithField(metric)) {
        metricAgg = { field: metric.field };
      }

      metricAgg = {
        ...metricAgg,
        ...(isMetricAggregationWithSettings(metric) && metric.settings),
      };

      aggField[metric.type] = metricAgg;
      nestedAggs.aggs[metric.id] = aggField;
    }

    return query;
  }

  getTermsQuery(queryDef: any) {
    const query: any = {
      size: 0,
      query: {
        bool: {
          filter: [{ range: this.getRangeFilter() }],
        },
      },
    };

    if (queryDef.query) {
      query.query.bool.filter.push({
        query_string: {
          analyze_wildcard: true,
          query: queryDef.query,
        },
      });
    }

    let size = 500;
    if (queryDef.size) {
      size = queryDef.size;
    }

    query.aggs = {
      '1': {
        terms: {
          field: queryDef.field,
          script: queryDef.script,
          size: size,
          order: {},
        },
      },
    };

    // Default behavior is to order results by { _key: asc }
    // queryDef.order allows selection of asc/desc
    // queryDef.orderBy allows selection of doc_count ordering (defaults desc)

    const { orderBy = 'key', order = orderBy === 'doc_count' ? 'desc' : 'asc' } = queryDef;

    if (['asc', 'desc'].indexOf(order) < 0) {
      throw { message: `Invalid query sort order ${order}` };
    }

    switch (orderBy) {
      case 'key':
      case 'term':
        // In Elasticsearch <= 6.0.0 we should use _term
        const keyName = this.flavor === Flavor.Elasticsearch && lt(this.version, '6.0.0') ? '_term' : '_key';
        query.aggs['1'].terms.order[keyName] = order;
        break;
      case 'doc_count':
        query.aggs['1'].terms.order['_count'] = order;
        break;
      default:
        throw { message: `Invalid query sort type ${orderBy}` };
    }

    return query;
  }

  getLogsQuery(target: OpenSearchQuery, adhocFilters?: any, querystring?: string) {
    let query: any = {
      size: 0,
      query: {
        bool: {
          filter: [{ range: this.getRangeFilter() }],
        },
      },
    };

    this.addAdhocFilters(query, adhocFilters);

    if (target.query) {
      query.query.bool.filter.push({
        query_string: {
          analyze_wildcard: true,
          query: querystring,
        },
      });
    }

    query = this.documentQuery(query, 500, 'desc');

    return {
      ...query,
      aggs: this.build(target, null, querystring).aggs,
    };
  }

  /* Adds Ad hoc filters for PPL:
   * Check for the value type and parse it accordingly so it can be added onto the query string through 'where' command
   */
  addPPLAdhocFilters(queryString: any, adhocFilters: any) {
    let i, value, adhocQuery;

    for (i = 0; i < adhocFilters.length; i++) {
      if (dateMath.isValid(adhocFilters[i].value)) {
        const validTime = dateTime(adhocFilters[i].value)
          .utc()
          .format('YYYY-MM-DD HH:mm:ss.SSSSSS');
        value = `timestamp('${validTime}')`;
      } else if (typeof adhocFilters[i].value === 'string') {
        value = `'${adhocFilters[i].value}'`;
      } else {
        value = adhocFilters[i].value;
      }
      adhocQuery = `\`${adhocFilters[i].key}\` ${adhocFilters[i].operator} ${value}`;

      if (i > 0) {
        queryString += ' and ' + adhocQuery;
      } else {
        queryString += ' | where ' + adhocQuery;
      }
    }
    return queryString;
  }

  buildPPLQuery(target: any, adhocFilters?: any, queryString?: string) {
    // make sure query has defaults
    target.format = target.format || defaultPPLFormat();
    target.queryType = QueryType.PPL;

    // set isLogsQuery depending on the format
    target.isLogsQuery = target.format === 'logs';

    if (adhocFilters) {
      queryString = this.addPPLAdhocFilters(queryString, adhocFilters);
    }

    const timeRangeFilter = " where $timestamp >= timestamp('$timeFrom') and $timestamp <= timestamp('$timeTo')";
    //time range filter must be placed before other query filters
    if (queryString) {
      const separatorIndex = queryString.indexOf('|');
      if (separatorIndex === -1) {
        queryString = [queryString.trimEnd(), timeRangeFilter].join(' |');
      } else {
        queryString = [
          queryString.slice(0, separatorIndex).trimEnd(),
          timeRangeFilter,
          queryString.slice(separatorIndex + 1),
        ].join(' |');
      }
    }

    return { query: queryString };
  }
}
