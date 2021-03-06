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
