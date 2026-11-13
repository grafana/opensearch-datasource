import { QueryType } from 'types';

interface SampleQuery {
  title: string;
  queryString: string;
}

const pplSampleQueries: SampleQuery[] = [
  {
    title: 'The title field contains the word `wind`',
    queryString: "SOURCE = your_index | WHERE LIKE(title, '%wind%') | HEAD 10",
  },
  {
    title: 'The title field contains the word `wind` or the word `windy`',
    queryString: "SOURCE = your_index | WHERE LIKE(title, '%wind%') OR LIKE(title, '%windy%') | HEAD 10",
  },
  {
    title: 'The title field contains the phrase `wind rises`',
    queryString: "SOURCE = your_index | WHERE LIKE(title, '%wind rises%') | HEAD 10",
  },
  {
    title: 'The title.keyword field exactly matches `The wind rises`',
    queryString: "SOURCE = your_index | WHERE title = 'The wind rises' | HEAD 10",
  },
];

const sqlSampleQueries: SampleQuery[] = [
  {
    title: 'The title field contains the word `wind`',
    queryString: "SELECT * FROM your_index WHERE MATCH_QUERY(title, 'wind') LIMIT 10",
  },
  {
    title: 'The title field contains the word `wind` or the word `windy`',
    queryString: "SELECT * FROM your_index WHERE MATCH_QUERY(title, 'wind') OR MATCH_QUERY(title, 'windy') LIMIT 10",
  },
  {
    title: 'The title field contains the phrase `wind rises`',
    queryString: "SELECT * FROM your_index WHERE MATCH_PHRASE(title, 'wind rises') LIMIT 10",
  },
  {
    title: 'The title field exactly matches `The wind rises`',
    queryString: "SELECT * FROM your_index WHERE title = 'The wind rises' LIMIT 10",
  },
];

const sampleQueriesByLanguage: Record<QueryType, SampleQuery[]> = {
  [QueryType.PPL]: pplSampleQueries,
  [QueryType.SQL]: sqlSampleQueries,
  // Lucene queries are built from the metric and bucket aggregation editors, so
  // there is no sample list for them.
  [QueryType.Lucene]: [],
};

export const getSampleQueries = (queryLanguage: QueryType): SampleQuery[] =>
  sampleQueriesByLanguage[queryLanguage] ?? pplSampleQueries;
