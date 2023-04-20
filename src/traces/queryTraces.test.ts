import { createLuceneTraceQuery } from './queryTraces';

describe('Query Traces: createLuceneTraceQuery', () => {
  it('creates a query for a single query when passed a traceId', () => {
    expect(createLuceneTraceQuery('traceId: 123').query.bool.must).toContainEqual({ term: { traceId: '123' } });
  });

  it('creates a query for all traces that match a lucene query when passed something besides a traceId', () => {
    expect(createLuceneTraceQuery('traceGroup: "HTTP GET /dispatch"').query.bool.must).toContainEqual({
      query_string: { analyze_wildcard: true, query: 'traceGroup: "HTTP GET /dispatch"' },
    });
  });

  it('creates a DSL query for all spans matching a trace when passed a lucene query containing a traceId', () => {
    expect(createLuceneTraceQuery('').query.bool.must).toContainEqual({
      query_string: { analyze_wildcard: true, query: '*' },
    });
  });
});
