import _ from 'lodash';
import flatten from './dependencies/flatten';
import * as queryDef from './query_def';
import TableModel from './dependencies/table_model';
import { DataFrame, toDataFrame, PreferredVisualisationType, toUtc } from '@grafana/data';
import { Aggregation, OpenSearchDataQueryResponse, OpenSearchQuery, QueryType } from './types';
import {
  ExtendedStatMetaType,
  isMetricAggregationWithField,
} from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { createEmptyDataFrame, describeMetric } from './utils';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';

export class OpenSearchResponse {
  constructor(
    private targets: OpenSearchQuery[],
    private response: any,
    private targetType: QueryType = QueryType.Lucene
  ) {
    this.targets = targets;
    this.response = response;
    this.targetType = targetType;
  }

  processMetrics(esAgg: any, target: OpenSearchQuery, seriesList: any, props: any) {
    let newSeries: any;

    for (let y = 0; y < target.metrics!.length; y++) {
      const metric = target.metrics![y];
      if (metric.hide) {
        continue;
      }

      switch (metric.type) {
        case 'count': {
          newSeries = { datapoints: [], metric: 'count', props, refId: target.refId };
          for (let i = 0; i < esAgg.buckets.length; i++) {
            const bucket = esAgg.buckets[i];
            const value = bucket.doc_count;
            newSeries.datapoints.push([value, bucket.key]);
          }
          seriesList.push(newSeries);
          break;
        }
        case 'percentiles': {
          if (esAgg.buckets.length === 0) {
            break;
          }

          const firstBucket = esAgg.buckets[0];
          const percentiles = firstBucket[metric.id].values;

          for (const percentileName in percentiles) {
            newSeries = {
              datapoints: [],
              metric: 'p' + percentileName,
              props: props,
              field: metric.field,
              refId: target.refId,
            };

            for (let i = 0; i < esAgg.buckets.length; i++) {
              const bucket = esAgg.buckets[i];
              const values = bucket[metric.id].values;
              newSeries.datapoints.push([values[percentileName], bucket.key]);
            }
            seriesList.push(newSeries);
          }

          break;
        }
        case 'extended_stats': {
          for (const statName in metric.meta) {
            if (!metric.meta[statName as ExtendedStatMetaType]) {
              continue;
            }

            newSeries = {
              datapoints: [],
              metric: statName,
              props: props,
              field: metric.field,
              refId: target.refId,
            };

            for (let i = 0; i < esAgg.buckets.length; i++) {
              const bucket = esAgg.buckets[i];
              const stats = bucket[metric.id];

              // add stats that are in nested obj to top level obj
              stats.std_deviation_bounds_upper = stats.std_deviation_bounds.upper;
              stats.std_deviation_bounds_lower = stats.std_deviation_bounds.lower;

              newSeries.datapoints.push([stats[statName], bucket.key]);
            }

            seriesList.push(newSeries);
          }

          break;
        }
        default: {
          newSeries = {
            datapoints: [],
            metric: metric.type,
            metricId: metric.id,
            props: props,
            refId: target.refId,
          };

          if (isMetricAggregationWithField(metric)) {
            newSeries.field = metric.field;
          }

          for (let i = 0; i < esAgg.buckets.length; i++) {
            const bucket = esAgg.buckets[i];
            const value = bucket[metric.id];

            if (value !== undefined) {
              if (value.normalized_value) {
                newSeries.datapoints.push([value.normalized_value, bucket.key]);
              } else {
                newSeries.datapoints.push([value.value, bucket.key]);
              }
            }
          }
          seriesList.push(newSeries);
          break;
        }
      }
    }
  }

  processAggregationDocs(esAgg: any, aggDef: Aggregation, target: OpenSearchQuery, table: any, props: any) {
    // add columns
    if (table.columns.length === 0) {
      for (const propKey of _.keys(props)) {
        table.addColumn({ text: propKey, filterable: true });
      }
      // @ts-ignore
      table.addColumn({ text: aggDef.field, filterable: true });
    }

    // helper func to add values to value array
    const addMetricValue = (values: any[], metricName: string, value: any) => {
      table.addColumn({ text: metricName });
      values.push(value);
    };
    const buckets = _.isArray(esAgg.buckets) ? esAgg.buckets : [esAgg.buckets];
    for (const bucket of buckets) {
      const values = [];

      for (const propValues of _.values(props)) {
        values.push(propValues);
      }

      // add bucket key (value)
      values.push(bucket.key);

      for (const metric of target.metrics || []) {
        switch (metric.type) {
          case 'count': {
            addMetricValue(values, this.getMetricName(metric.type), bucket.doc_count);
            break;
          }
          case 'extended_stats': {
            for (const statName in metric.meta) {
              if (!metric.meta[statName as ExtendedStatMetaType]) {
                continue;
              }

              const stats = bucket[metric.id];
              // add stats that are in nested obj to top level obj
              stats.std_deviation_bounds_upper = stats.std_deviation_bounds.upper;
              stats.std_deviation_bounds_lower = stats.std_deviation_bounds.lower;

              addMetricValue(values, this.getMetricName(statName as ExtendedStatMetaType), stats[statName]);
            }
            break;
          }
          case 'percentiles': {
            const percentiles = bucket[metric.id].values;

            for (const percentileName in percentiles) {
              addMetricValue(values, `p${percentileName} ${metric.field}`, percentiles[percentileName]);
            }
            break;
          }
          default: {
            let metricName = this.getMetricName(metric.type);
            const otherMetrics = _.filter(target.metrics, { type: metric.type });

            // if more of the same metric type include field field name in property
            if (otherMetrics.length > 1) {
              if (isMetricAggregationWithField(metric)) {
                metricName += ' ' + metric.field;
              }

              if (metric.type === 'bucket_script') {
                //Use the formula in the column name
                metricName = metric.settings?.script || '';
              }
            }

            addMetricValue(values, metricName, bucket[metric.id].value);
            break;
          }
        }
      }

      table.rows.push(values);
    }
  }

  // This is quite complex
  // need to recurse down the nested buckets to build series
  processBuckets(aggs: any, target: OpenSearchQuery, seriesList: any, table: TableModel, props: any, depth: number) {
    let bucket, aggDef: any, esAgg, aggId;
    const maxDepth = target.bucketAggs!.length - 1;

    for (aggId in aggs) {
      aggDef = _.find(target.bucketAggs, { id: aggId });
      esAgg = aggs[aggId];

      if (!aggDef) {
        continue;
      }

      if (depth === maxDepth) {
        if (aggDef.type === 'date_histogram') {
          this.processMetrics(esAgg, target, seriesList, props);
        } else {
          this.processAggregationDocs(esAgg, aggDef, target, table, props);
        }
      } else {
        for (const nameIndex in esAgg.buckets) {
          bucket = esAgg.buckets[nameIndex];
          props = _.clone(props);
          if (bucket.key !== void 0) {
            props[aggDef.field] = bucket.key;
          } else {
            props['filter'] = nameIndex;
          }
          if (bucket.key_as_string) {
            props[aggDef.field] = bucket.key_as_string;
          }
          this.processBuckets(bucket, target, seriesList, table, props, depth + 1);
        }
      }
    }
  }

  private getMetricName(metric: string): string {
    const metricDef = Object.entries(metricAggregationConfig)
      .filter(([key]) => key === metric)
      .map(([_, value]) => value)[0];

    if (metricDef) {
      return metricDef.label;
    }

    const extendedStat = queryDef.extendedStats.find((e) => e.value === metric);
    if (extendedStat) {
      return extendedStat.label;
    }

    return metric;
  }

  private getSeriesName(series: any, target: OpenSearchQuery, metricTypeCount: any) {
    let metricName = this.getMetricName(series.metric);

    if (target.alias) {
      const regex = /\{\{([\s\S]+?)\}\}/g;

      return target.alias.replace(regex, (match: any, g1: any, g2: any) => {
        const group = g1 || g2;

        if (group.indexOf('term ') === 0) {
          return series.props[group.substring(5)];
        }
        if (series.props[group] !== void 0) {
          return series.props[group];
        }
        if (group === 'metric') {
          return metricName;
        }
        if (group === 'field') {
          return series.field || '';
        }

        return match;
      });
    }

    if (queryDef.isPipelineAgg(series.metric)) {
      if (series.metric && queryDef.isPipelineAggWithMultipleBucketPaths(series.metric)) {
        const agg: any = _.find(target.metrics, { id: series.metricId });
        if (agg && agg.settings.script) {
          metricName = agg.settings.script;

          for (const pv of agg.pipelineVariables) {
            const appliedAgg: any = _.find(target.metrics, { id: pv.pipelineAgg });
            if (appliedAgg) {
              metricName = metricName.replace('params.' + pv.name, describeMetric(appliedAgg));
            }
          }
        } else {
          metricName = 'Unset';
        }
      } else {
        const appliedAgg: any = _.find(target.metrics, { id: series.field });
        if (appliedAgg) {
          metricName += ' ' + describeMetric(appliedAgg);
        } else {
          metricName = 'Unset';
        }
      }
    } else if (series.field) {
      metricName += ' ' + series.field;
    }

    const propKeys = _.keys(series.props);
    if (propKeys.length === 0) {
      return metricName;
    }

    let name = '';
    for (const propName in series.props) {
      name += series.props[propName] + ' ';
    }

    if (metricTypeCount === 1) {
      return name.trim();
    }

    return name.trim() + ' ' + metricName;
  }

  nameSeries(seriesList: any, target: OpenSearchQuery) {
    const metricTypeCount = _.uniq(_.map(seriesList, 'metric')).length;

    for (let i = 0; i < seriesList.length; i++) {
      const series = seriesList[i];
      series.target = this.getSeriesName(series, target, metricTypeCount);
    }
  }

  processHits(hits: { total: { value: any }; hits: any[] }, seriesList: any[], target: OpenSearchQuery) {
    const hitsTotal = typeof hits.total === 'number' ? hits.total : hits.total.value; // <- Works with Elasticsearch 7.0+

    const series: any = {
      target: target.refId,
      type: 'docs',
      refId: target.refId,
      datapoints: [],
      total: hitsTotal,
      filterable: true,
    };
    let propName, hit, doc: any, i;

    for (i = 0; i < hits.hits.length; i++) {
      hit = hits.hits[i];
      doc = {
        _id: hit._id,
        _type: hit._type,
        _index: hit._index,
      };

      if (hit._source) {
        for (propName in hit._source) {
          doc[propName] = hit._source[propName];
        }
      }

      for (propName in hit.fields) {
        doc[propName] = hit.fields[propName];
      }
      series.datapoints.push(doc);
    }

    seriesList.push(series);
  }

  trimDatapoints(aggregations: any, target: OpenSearchQuery) {
    const histogram: any = _.find(target.bucketAggs, { type: 'date_histogram' });

    const shouldDropFirstAndLast = histogram && histogram.settings && histogram.settings.trimEdges;
    if (shouldDropFirstAndLast) {
      const trim = histogram.settings.trimEdges;
      for (const prop in aggregations) {
        const points = aggregations[prop];
        if (points.datapoints.length > trim * 2) {
          points.datapoints = points.datapoints.slice(trim, points.datapoints.length - trim);
        }
      }
    }
  }

  getErrorFromResponse(response: any, err: any) {
    const result: any = {};
    result.data = JSON.stringify(err, null, 4);
    if (err.root_cause && err.root_cause.length > 0 && err.root_cause[0].reason) {
      result.message = err.root_cause[0].reason;
    } else {
      result.message = err.reason || 'Unknown OpenSearch error response';
    }

    if (response.$$config) {
      result.config = response.$$config;
    }

    return result;
  }

  getInvalidPPLQuery(response: any) {
    const result: any = {};
    result.message = 'Invalid time series query';

    if (response.$$config) {
      result.config = response.$$config;
    }

    return result;
  }

  getTimeSeries(): OpenSearchDataQueryResponse {
    if (this.targetType === QueryType.PPL) {
      return this.processPPLTimeSeries();
    } else if (this.targets.some((target) => target.metrics?.some((metric) => metric.type === 'raw_data'))) {
      return this.processResponseToDataFrames(false);
    }
    return this.processLuceneTimeSeries();
  }

  getLogs(logMessageField?: string, logLevelField?: string): OpenSearchDataQueryResponse {
    if (this.targetType === QueryType.PPL) {
      return this.processPPLResponseToDataFrames(true, logMessageField, logLevelField);
    }
    return this.processResponseToDataFrames(true, logMessageField, logLevelField);
  }

  getTable() {
    return this.processPPLResponseToDataFrames(false);
  }

  processResponseToDataFrames(
    isLogsRequest: boolean,
    logMessageField?: string,
    logLevelField?: string
  ): OpenSearchDataQueryResponse {
    const dataFrame: DataFrame[] = [];

    for (let n = 0; n < this.response.responses.length; n++) {
      const response = this.response.responses[n];
      if (response.error) {
        throw this.getErrorFromResponse(this.response, response.error);
      }

      if (response.hits && response.hits.hits.length > 0) {
        const { propNames, docs } = flattenHits(response.hits.hits);
        if (docs.length > 0) {
          let series = createEmptyDataFrame(
            propNames,
            isLogsRequest,
            this.targetType,
            logMessageField,
            logLevelField,
            this.targets[0].timeField!
          );

          // Add a row for each document
          for (const doc of docs) {
            if (logLevelField) {
              // Remap level field based on the datasource config. This field is then used in explore to figure out the
              // log level. We may rewrite some actual data in the level field if they are different.
              doc['level'] = doc[logLevelField];
            }

            series.add(doc);
          }
          if (isLogsRequest) {
            series = addPreferredVisualisationType(series, 'logs');
          }
          const target = this.targets[n];
          series.refId = target.refId;
          dataFrame.push(series);
        }
      }

      if (response.aggregations) {
        const aggregations = response.aggregations;
        const target = this.targets[n];
        const tmpSeriesList: any[] = [];
        const table = new TableModel();

        this.processBuckets(aggregations, target, tmpSeriesList, table, {}, 0);
        this.trimDatapoints(tmpSeriesList, target);
        this.nameSeries(tmpSeriesList, target);

        if (table.rows.length > 0) {
          const series = toDataFrame(table);
          series.refId = target.refId;
          dataFrame.push(series);
        }

        for (let y = 0; y < tmpSeriesList.length; y++) {
          let series = toDataFrame(tmpSeriesList[y]);

          // When log results, show aggregations only in graph. Log fields are then going to be shown in table.
          if (isLogsRequest) {
            series = addPreferredVisualisationType(series, 'graph');
          }

          series.refId = target.refId;
          dataFrame.push(series);
        }
      }
    }

    return { data: dataFrame, key: this.targets[0]?.refId };
  }

  processLuceneTimeSeries = (): OpenSearchDataQueryResponse => {
    const seriesList = [];

    for (let i = 0; i < this.response.responses.length; i++) {
      const response = this.response.responses[i];
      const target = this.targets[i];

      if (response.error) {
        throw this.getErrorFromResponse(this.response, response.error);
      }

      if (response.hits && response.hits.hits.length > 0) {
        this.processHits(response.hits, seriesList, target);
      }

      if (response.aggregations) {
        const aggregations = response.aggregations;
        const target = this.targets[i];
        const tmpSeriesList: any[] = [];
        const table = new TableModel();
        table.refId = target.refId;

        this.processBuckets(aggregations, target, tmpSeriesList, table, {}, 0);
        this.trimDatapoints(tmpSeriesList, target);
        this.nameSeries(tmpSeriesList, target);

        for (let y = 0; y < tmpSeriesList.length; y++) {
          seriesList.push(tmpSeriesList[y]);
        }

        if (table.rows.length > 0) {
          seriesList.push(table);
        }
      }
    }

    return { data: seriesList.map((item) => toDataFrame(item)), key: this.targets[0]?.refId };
  };

  processPPLTimeSeries = (): OpenSearchDataQueryResponse => {
    const target = this.targets[0];
    const response = this.response;
    const seriesList = [];

    if (response.datarows.length > 0) {
      // Handle error from OpenSearch
      if (response.error) {
        throw this.getErrorFromResponse(this.response, response.error);
      }
      // Get the data points and target that will be inputted to newSeries
      const { datapoints, targetVal, invalidTS } = getPPLDatapoints(response);

      // We throw an error if the inputted query is not valid
      if (invalidTS) {
        throw this.getInvalidPPLQuery(this.response);
      }

      const newSeries = {
        datapoints,
        props: response.schema,
        refId: target.refId,
        target: targetVal,
      };
      seriesList.push(newSeries);
    }
    return { data: seriesList.map((item) => toDataFrame(item)), key: this.targets[0]?.refId };
  };

  processPPLResponseToDataFrames(
    isLogsRequest: boolean,
    logMessageField?: string,
    logLevelField?: string
  ): OpenSearchDataQueryResponse {
    if (this.response.error) {
      throw this.getErrorFromResponse(this.response, this.response.error);
    }

    const dataFrame: DataFrame[] = [];

    //map the schema into an array of string containing its name
    const schema = new Map<string, string>(
      this.response.schema.map((a: { name: string; type: string }) => [a.name, a.type])
    );
    //combine the schema key and response value
    const response = _.map(this.response.datarows, (arr) => _.zipObject([...schema.keys()], arr));
    //flatten the response
    const { flattenSchema, docs } = flattenResponses(response);

    if (response.length > 0) {
      let series = createEmptyDataFrame(
        flattenSchema,
        isLogsRequest,
        this.targetType,
        logMessageField,
        logLevelField,
        this.targets[0].timeField!
      );
      // Add a row for each document
      for (const doc of docs) {
        if (logLevelField) {
          // Remap level field based on the datasource config. This field is then used in explore to figure out the
          // log level. We may rewrite some actual data in the level field if they are different.
          doc['level'] = doc[logLevelField];
        }

        // Convert every property that is a timestamp or datetime to the local time representation.
        // Log visualisation in Grafana will handle this, so we don't need to do this on logs requests.
        // Format is based on https://opensearch.org/docs/latest/search-plugins/sql/datatypes/
        if (!isLogsRequest) {
          for (let [property, type] of schema) {
            // based on https://opensearch.org/docs/1.3/observability-plugin/ppl/datatypes/ we only need to support those two formats.
            if (type === 'timestamp' || type === 'datetime') {
              doc[property] = toUtc(doc[property]).local().format('YYYY-MM-DD HH:mm:ss.SSS');
            }
          }
        }
        series.add(doc);
      }
      if (isLogsRequest) {
        series = addPreferredVisualisationType(series, 'logs');
      }
      const target = this.targets[0];
      series.refId = target.refId;
      dataFrame.push(series);
    }
    return { data: dataFrame, key: this.targets[0]?.refId };
  }
}

type Doc = {
  _id: string;
  _type: string;
  _index: string;
  _source?: any;
};

/**
 * Flatten the docs from response mainly the _source part which can be nested. This flattens it so that it is one level
 * deep and the keys are: `level1Name.level2Name...`. Also returns list of all properties from all the docs (not all
 * docs have to have the same keys).
 * @param hits
 */
const flattenHits = (hits: Doc[]): { docs: Array<Record<string, any>>; propNames: string[] } => {
  const docs: any[] = [];
  // We keep a list of all props so that we can create all the fields in the dataFrame, this can lead
  // to wide sparse dataframes in case the scheme is different per document.
  let propNames: string[] = [];

  for (const hit of hits) {
    const flattened = hit._source ? flatten(hit._source) : {};
    const doc = {
      _id: hit._id,
      _type: hit._type,
      _index: hit._index,
      _source: { ...flattened },
      ...flattened,
    };

    for (const propName of Object.keys(doc)) {
      if (propNames.indexOf(propName) === -1) {
        propNames.push(propName);
      }
    }

    docs.push(doc);
  }

  propNames.sort();
  return { docs, propNames };
};

/**
 * Flatten the response which can be nested. This flattens it so that it is one level deep and the keys are:
 * `level1Name.level2Name...`. Also returns list of all schemas from all the response
 * @param responses
 */
const flattenResponses = (responses: any): { docs: Array<Record<string, any>>; flattenSchema: string[] } => {
  const docs: any[] = [];
  // We keep a list of all schemas so that we can create all the fields in the dataFrame, this can lead
  // to wide sparse dataframes in case the scheme is different per document.
  let flattenSchema: string[] = [];

  for (const response of responses) {
    const doc = flatten(response);

    for (const schema of Object.keys(doc)) {
      if (flattenSchema.indexOf(schema) === -1) {
        flattenSchema.push(schema);
      }
    }
    docs.push(doc);
  }
  return { docs, flattenSchema };
};

/**
 * Returns the datapoints and target needed for parsing PPL time series response.
 * Also checks to ensure the query is a valid time series query
 * @param responses
 */
const getPPLDatapoints = (response: any): { datapoints: any; targetVal: any; invalidTS: boolean } => {
  let invalidTS = false;

  // We check if a valid date type is contained in the response
  const timeFieldIndex = _.findIndex(
    response.schema,
    (field: { type: string }) => field.type === 'timestamp' || field.type === 'datetime' || field.type === 'date'
  );

  const valueIndex = timeFieldIndex === 0 ? 1 : 0;

  //time series response should include a value field and timestamp
  if (
    timeFieldIndex === -1 ||
    response.datarows[0].length !== 2 ||
    typeof response.datarows[0][valueIndex] !== 'number'
  ) {
    invalidTS = true;
  }

  const datapoints = _.map(response.datarows, (datarow) => {
    const newDatarow = _.clone(datarow);
    const [timestamp] = newDatarow.splice(timeFieldIndex, 1);
    newDatarow.push(toUtc(timestamp).unix() * 1000);
    return newDatarow;
  });

  const targetVal = response.schema[valueIndex]?.name;

  return { datapoints, targetVal, invalidTS };
};

export const addPreferredVisualisationType = (series: any, type: PreferredVisualisationType) => {
  let s = series;
  s.meta
    ? (s.meta.preferredVisualisationType = type)
    : (s.meta = {
        preferredVisualisationType: type,
      });

  return s;
};
