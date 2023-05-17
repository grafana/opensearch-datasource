import { DataQueryResponse } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { LuceneQueryType, OpenSearchQuery, QueryType } from 'types';

export function trackQuery(response: DataQueryResponse, queries: OpenSearchQuery[], app: string): void {
  for (const query of queries) {
    try {
      reportInteraction('grafana_opensearch_query_executed', {
        app,
        with_lucene_query: query.queryType === QueryType.Lucene,
        with_ppl_query: query.queryType === QueryType.PPL,
        query_type: getQueryType(query),
        has_data: response.data.some(frame => frame.datapoints?.length > 0),
        has_error: response.error !== undefined,
        simultaneously_sent_query_count: queries.length,
        alias: query.alias,
      });
    } catch (error) {
      console.error('error while reporting opensearch query', error);
    }
  }
}

function getQueryType(query: OpenSearchQuery) {
  if (query.isLogsQuery) {
    return 'logs';
  }

  if (query.luceneQueryType === LuceneQueryType.Traces) {
    return 'traces';
  }

  // PPL queries are a bit special, as they can be either raw_data or metric, depending on the format
  if (query.queryType === QueryType.PPL) {
    return query.format === 'table' ? 'raw_data' : 'metric';
  }

  const types = ['raw_data', 'raw_document'];
  if (types.includes(query.metrics[0].type)) {
    return query.metrics[0].type;
  }
  return 'metric';
}
