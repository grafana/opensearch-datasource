import { LuceneQueryObj, OpenSearchQuery } from 'types';

export const createLuceneTraceQuery = (query: OpenSearchQuery): LuceneQueryObj => {
  const luceneQuery = query.query;

  const traceId = getTraceIdFromLuceneQueryString(luceneQuery);

  if (traceId) {
    return getSingleTraceQuery(traceId);
  }

  return createListTracesQuery(luceneQuery);
};

const createListTracesQuery = (queryString: string): LuceneQueryObj => {
  return {
    size: 10,
    query: {
      bool: {
        must: [
          { range: { startTime: { gte: '$timeFrom', lte: '$timeTo' } } },
          {
            query_string: {
              analyze_wildcard: true,
              query: queryString || '*',
            },
          },
        ],
        filter: [],
        should: [],
        must_not: [],
      },
    },
    aggs: {
      // create a set of buckets that we call traces
      traces: {
        // each of those buckets in traces is sorted by a key of their traceId
        // they contain any document, in this case all the spans of a trace
        terms: {
          field: 'traceId',
          size: 100,
          order: { _key: 'asc' },
        },
        // within each of those buckets we create further aggregations based on what's in that bucket
        aggs: {
          // one of those aggregations is a metric we call latency which is based on the durationInNanos
          // this script was taken directly from the network tab in the traces dashboard
          latency: {
            max: {
              script: {
                source:
                  "\n                if (doc.containsKey('traceGroupFields.durationInNanos') && !doc['traceGroupFields.durationInNanos'].empty) {\n                  return Math.round(doc['traceGroupFields.durationInNanos'].value / 10000) / 100.0\n                }\n                return 0\n                ",
                lang: 'painless',
              },
            },
          },
          // one of those aggregations is the first traceGroup value it finds in the bucket
          trace_group: {
            terms: {
              field: 'traceGroup',
              size: 1,
            },
          },
          // one of aggregations is the the number of items in the bucket that has a status code of 2
          error_count: {
            filter: { term: { 'traceGroupFields.statusCode': '2' } },
          },
          // one of those aggregations is the span with the max endTime
          last_updated: { max: { field: 'traceGroupFields.endTime' } },
        },
      },
    },
  };
};

const getSingleTraceQuery = (traceId: string): LuceneQueryObj => {
  return {
    size: 1000,
    query: {
      bool: {
        must: [{ range: { startTime: { gte: '$timeFrom', lte: '$timeTo' } } }, { term: { traceId: traceId } }],
        filter: [],
        should: [],
        must_not: [],
      },
    },
  };
};

// used to determine if a traces query is for a trace list or a single trace
export const getTraceIdFromLuceneQueryString = (luceneQuery: string) => {
  const matches = luceneQuery.match(/(?<=traceId:).*$/);
  return matches ? matches[0].trim() : '';
};
