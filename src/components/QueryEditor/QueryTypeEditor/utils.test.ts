import { getQueryTypeOptions } from './utils';
import { QueryType } from '../../../types';

describe('getQueryTypeOptions', () => {
  describe('given no supported types', () => {
    const queryTypeOptions = getQueryTypeOptions([]);
    it('should return no query type options', () => {
      expect(queryTypeOptions.length).toBe(0);
    });
  });

  describe('given Lucene as a supported type', () => {
    const queryTypeOptions = getQueryTypeOptions([QueryType.Lucene]);
    it('should return Lucene query type option', () => {
      expect(queryTypeOptions.length).toBe(1);
      expect(queryTypeOptions[0].value).toBe(QueryType.Lucene);
    });
  });
});

describe('getQueryTypeOptions with a current query type', () => {
  it('keeps a query type that is saved but not supported, marked as disabled', () => {
    const options = getQueryTypeOptions([QueryType.Lucene], QueryType.SQL);

    expect(options.map((option) => option.value)).toEqual([QueryType.Lucene, QueryType.SQL]);
    expect(options.map((option) => option.label)).toEqual(['Lucene', 'SQL (disabled)']);
  });

  it('does not mark a supported query type', () => {
    const options = getQueryTypeOptions([QueryType.Lucene, QueryType.SQL], QueryType.SQL);

    expect(options.map((option) => option.label)).toEqual(['Lucene', 'SQL']);
  });

  it('leaves the options unchanged when there is no current query type', () => {
    const options = getQueryTypeOptions([QueryType.Lucene, QueryType.PPL]);

    expect(options.map((option) => option.value)).toEqual([QueryType.Lucene, QueryType.PPL]);
  });
});
