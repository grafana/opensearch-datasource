interface SampleQuery {
  title: string;
  queryString: string;
}

export const sampleQueries: SampleQuery[] = [
  {
    title: 'The title field contains the word `wind`',
    queryString: "SOURCE = your_index | WHERE LIKE(title, '%wind%') LIMIT 10",
  },
  {
    title: 'The title field contains the word `wind` or the word `windy`',
    queryString: "SOURCE = your_index | WHERE LIKE(title, '%wind%') OR LIKE(title, '%windy%') LIMIT 10",
  },
  {
    title: 'The title field contains the phrase `wind rises`',
    queryString: "SOURCE = your_index | WHERE LIKE(title, '%wind rises%') LIMIT 10",
  },
  {
    title: 'The title.keyword field exactly matches `The wind rises`',
    queryString: "SOURCE = your_index | WHERE title = 'The wind rises' LIMIT 10",
  },
];
