import { AdHocVariableFilter, ToggleFilterAction } from '@grafana/data';
import {
  luceneQueryHasFilter,
  removeFilterFromLuceneQuery,
  addAdHocFilterToLuceneQuery,
  addStringFilterToQuery,
  PPLQueryHasFilter,
  toggleQueryFilterForPPL,
  toggleQueryFilterForLucene,
} from './modifyQuery';

describe('luceneQueryHasFilter', () => {
  it('should return true if the query contains the positive filter', () => {
    expect(luceneQueryHasFilter('label:"value"', 'label', 'value')).toBe(true);
    expect(luceneQueryHasFilter('label: "value"', 'label', 'value')).toBe(true);
    expect(luceneQueryHasFilter('label : "value"', 'label', 'value')).toBe(true);
    expect(luceneQueryHasFilter('label:value', 'label', 'value')).toBe(true);
    expect(luceneQueryHasFilter('this:"that" AND label:value', 'label', 'value')).toBe(true);
    expect(luceneQueryHasFilter('this:"that" OR (test:test AND label:value)', 'label', 'value')).toBe(true);
    expect(luceneQueryHasFilter('this:"that" OR (test:test AND label:value)', 'test', 'test')).toBe(true);
    expect(luceneQueryHasFilter('(this:"that" OR test:test) AND label:value', 'this', 'that')).toBe(true);
    expect(luceneQueryHasFilter('(this:"that" OR test:test) AND label:value', 'test', 'test')).toBe(true);
    expect(luceneQueryHasFilter('(this:"that" OR test :test) AND label:value', 'test', 'test')).toBe(true);
    expect(
      luceneQueryHasFilter(
        'message:"Jun 20 17:19:47 Xtorm syslogd[348]: ASL Sender Statistics"',
        'message',
        'Jun 20 17:19:47 Xtorm syslogd[348]: ASL Sender Statistics'
      )
    ).toBe(true);
  });
  it('should return false if the query does not contain the positive filter', () => {
    expect(luceneQueryHasFilter('label:"value"', 'label', 'otherValue')).toBe(false);
    expect(luceneQueryHasFilter('-label:"value"', 'label', 'value')).toBe(false);
    expect(luceneQueryHasFilter('-this:"that" AND these:"those"', 'this', 'those')).toBe(false);
  });
  it('should return true if the query contains the negative filter', () => {
    expect(luceneQueryHasFilter('-label:"value"', 'label', 'value', '-')).toBe(true);
    expect(luceneQueryHasFilter('-label: "value"', 'label', 'value', '-')).toBe(true);
    expect(luceneQueryHasFilter('-label : "value"', 'label', 'value', '-')).toBe(true);
    expect(luceneQueryHasFilter('-label:value', 'label', 'value', '-')).toBe(true);
    expect(luceneQueryHasFilter('this:"that" AND -label:value', 'label', 'value', '-')).toBe(true);
  });
  it('should return false if the query does not contain the negative filter', () => {
    expect(luceneQueryHasFilter('label:"value"', 'label', 'otherValue', '-')).toBe(false);
    expect(luceneQueryHasFilter('label:"value"', 'label', 'value', '-')).toBe(false);
  });
  it('should support filters containing colons', () => {
    expect(luceneQueryHasFilter('label\\:name:"value"', 'label:name', 'value')).toBe(true);
    expect(luceneQueryHasFilter('-label\\:name:"value"', 'label:name', 'value', '-')).toBe(true);
  });
  it('should support filters containing quotes', () => {
    expect(luceneQueryHasFilter('label\\:name:"some \\"value\\""', 'label:name', 'some "value"')).toBe(true);
    expect(luceneQueryHasFilter('-label\\:name:"some \\"value\\""', 'label:name', 'some "value"', '-')).toBe(true);
  });
});

describe('addFilterToQuery', () => {
  it('should add a positive filter to the query', () => {
    expect(addAdHocFilterToLuceneQuery('', 'label', 'value')).toBe('label:"value"');
  });
  it('should add a positive filter to the query with other filters', () => {
    expect(addAdHocFilterToLuceneQuery('label2:"value2"', 'label', 'value')).toBe('label2:"value2" AND label:"value"');
  });
  it('should add a negative filter to the query', () => {
    expect(addAdHocFilterToLuceneQuery('', 'label', 'value', '-')).toBe('-label:"value"');
  });
  it('should add a negative filter to the query with other filters', () => {
    expect(addAdHocFilterToLuceneQuery('label2:"value2"', 'label', 'value', '-')).toBe(
      'label2:"value2" AND -label:"value"'
    );
  });
  it('should support filters with colons', () => {
    expect(addAdHocFilterToLuceneQuery('', 'label:name', 'value')).toBe('label\\:name:"value"');
  });
  it('should support filters with quotes', () => {
    expect(addAdHocFilterToLuceneQuery('', 'label:name', 'the "value"')).toBe('label\\:name:"the \\"value\\""');
  });
});

describe('removeFilterFromLucene Query', () => {
  it('should remove filter from query', () => {
    expect(removeFilterFromLuceneQuery('label:"value"', 'label', 'value')).toBe('');
  });
  it('should remove filter from query with other filters', () => {
    expect(removeFilterFromLuceneQuery('label:"value" AND label2:"value2"', 'label', 'value')).toBe('label2:"value2"');
    expect(removeFilterFromLuceneQuery('label:value AND label2:"value2"', 'label', 'value')).toBe('label2:"value2"');
    expect(removeFilterFromLuceneQuery('label : "value" OR label2:"value2"', 'label', 'value')).toBe('label2:"value2"');
    expect(removeFilterFromLuceneQuery('test:"test" OR label:"value" AND label2:"value2"', 'label', 'value')).toBe(
      'test:"test" OR label2:"value2"'
    );
    expect(removeFilterFromLuceneQuery('test:"test" OR (label:"value" AND label2:"value2")', 'label', 'value')).toBe(
      'test:"test" OR label2:"value2"'
    );
    expect(removeFilterFromLuceneQuery('(test:"test" OR label:"value") AND label2:"value2"', 'label', 'value')).toBe(
      '(test:"test") AND label2:"value2"'
    );
    expect(removeFilterFromLuceneQuery('(test:"test" OR label:"value") AND label2:"value2"', 'test', 'test')).toBe(
      'label:"value" AND label2:"value2"'
    );
    expect(removeFilterFromLuceneQuery('test:"test" OR (label:"value" AND label2:"value2")', 'label2', 'value2')).toBe(
      'test:"test" OR (label:"value")'
    );
  });
  it('should not remove the wrong filter', () => {
    expect(removeFilterFromLuceneQuery('-label:"value" AND label2:"value2"', 'label', 'value')).toBe(
      '-label:"value" AND label2:"value2"'
    );
    expect(removeFilterFromLuceneQuery('label2:"value2" OR -label:value', 'label', 'value')).toBe(
      'label2:"value2" OR -label:value'
    );
    expect(removeFilterFromLuceneQuery('-label : "value" OR label2:"value2"', 'label', 'value')).toBe(
      '-label : "value" OR label2:"value2"'
    );
  });
  it('should support filters with colons', () => {
    expect(removeFilterFromLuceneQuery('label\\:name:"value"', 'label:name', 'value')).toBe('');
  });
  it('should support filters with quotes', () => {
    expect(removeFilterFromLuceneQuery('label\\:name:"the \\"value\\""', 'label:name', 'the "value"')).toBe('');
  });
});

describe('addStringFilterToQuery', () => {
  it('should add a positive filter to a query', () => {
    expect(addStringFilterToQuery('label:"value"', 'filter')).toBe('label:"value" AND "filter"');
    expect(addStringFilterToQuery('', 'filter')).toBe('"filter"');
    expect(addStringFilterToQuery(' ', 'filter')).toBe('"filter"');
  });

  it('should add a negative filter to a query', () => {
    expect(addStringFilterToQuery('label:"value"', 'filter', false)).toBe('label:"value" NOT "filter"');
    expect(addStringFilterToQuery('', 'filter', false)).toBe('NOT "filter"');
    expect(addStringFilterToQuery(' ', 'filter', false)).toBe('NOT "filter"');
  });

  it('should escape filter values', () => {
    expect(addStringFilterToQuery('label:"value"', '"filter"')).toBe('label:"value" AND "\\"filter\\""');
    expect(addStringFilterToQuery('label:"value"', '"filter"', false)).toBe('label:"value" NOT "\\"filter\\""');
  });

  it('should escape filter values with backslashes', () => {
    expect(addStringFilterToQuery('label:"value"', '"filter with \\"')).toBe(
      'label:"value" AND "\\"filter with \\\\\\""'
    );
    expect(addStringFilterToQuery('label:"value"', '"filter with \\"', false)).toBe(
      'label:"value" NOT "\\"filter with \\\\\\""'
    );
  });
});
describe('PPLQueryHasFilter', () => {
  const adHocFilter: AdHocVariableFilter = {
    key: 'AvgTicketPrice',
    value: '904',
    operator: '!=',
  };
  it('should return true if the query contains the positive filter', () => {
    expect(PPLQueryHasFilter('search source=opensearch_dashboards_sample_data_flights | where `AvgTicketPrice` != 904', adHocFilter)).toBe(true);
    expect(PPLQueryHasFilter('search source=opensearch_dashboards_sample_data_flights | where `AvgTicketPrice` > 904', {...adHocFilter, operator: '>'})).toBe(true);
  });
  it('should return false if the query does not contain the positive filter', () => {
    expect(PPLQueryHasFilter('search source=opensearch_dashboards_sample_data_flights | where `AvgTicketPrice` = 904', adHocFilter)).toBe(false);
  });
});
describe('toggleQueryFilterForLucene', () => {
  describe('FILTER_FOR', () => {
    it('should add a positive filter to the query', () => {
      const queryString = "AvgTicketPrice:400";
      const filter: ToggleFilterAction = {
        options: {
          key: 'DestAirport',
          value: 'Paris'
        },
        type: 'FILTER_FOR'
      };
      expect(toggleQueryFilterForLucene(queryString, filter)).toBe("AvgTicketPrice:400 AND DestAirport:\"Paris\"");
    });
    it('should add a negative filter to the query', () => {
      const queryString = "AvgTicketPrice:400";
      const filter: ToggleFilterAction = {
        options: {
          key: 'DestAirport',
          value: 'Paris'
        },
        type: 'FILTER_OUT'
      };
      expect(toggleQueryFilterForLucene(queryString, filter)).toBe("AvgTicketPrice:400 AND -DestAirport:\"Paris\"");
    });
    it('should remove a positive filter if the query already contains it', () => {
      const queryString = "AvgTicketPrice:400 AND DestAirport:\"Paris\"";
      const filter: ToggleFilterAction = {
        options: {
          key: 'DestAirport',
          value: 'Paris'
        },
        type: 'FILTER_FOR'
      };
      expect(toggleQueryFilterForLucene(queryString, filter)).toBe("AvgTicketPrice:400");
    });
    it('should remove a positive filter if a negative filter is passed, then add the negative filter', () => {
      const queryString = "AvgTicketPrice:400 AND DestAirport:\"Paris\"";
      const filter: ToggleFilterAction = {
        options: {
          key: 'DestAirport',
          value: 'Paris'
        },
        type: 'FILTER_OUT'
      };
      expect(toggleQueryFilterForLucene(queryString, filter)).toBe("AvgTicketPrice:400 AND -DestAirport:\"Paris\"");
    });
  });
})
describe('toggleQueryFilterForPPL', () => {
  describe('FILTER_FOR', () => {
    it('should add a positive filter to the query', () => {
      const queryString = 'search source=opensearch_dashboards_sample_data_flights | where `AvgTicketPrice` = 904';
      const filter: ToggleFilterAction = {
        options: {
          key: 'DestAirport',
          value: 'Paris'
        },
        type: 'FILTER_FOR'
      };
      expect(toggleQueryFilterForPPL(queryString, filter)).toBe("search source=opensearch_dashboards_sample_data_flights | where `AvgTicketPrice` = 904 | where `DestAirport` = 'Paris'");
    });
    it('should add a negative filter to the query', () => {
      const queryString = 'search source=opensearch_dashboards_sample_data_flights | where `AvgTicketPrice` = 904';
      const filter: ToggleFilterAction = {
        options: {
          key: 'DestAirport',
          value: 'Paris'
        },
        type: 'FILTER_OUT'
      };
      expect(toggleQueryFilterForPPL(queryString, filter)).toBe("search source=opensearch_dashboards_sample_data_flights | where `AvgTicketPrice` = 904 | where `DestAirport` != 'Paris'");
    });
    it('should remove a positive filter if the query already contains it', () => {
      const queryString = "search source=opensearch_dashboards_sample_data_flights | where `AvgTicketPrice` = 904 | where `DestAirport` = 'Paris'"
      const filter: ToggleFilterAction = {
        options: {
          key: 'DestAirport',
          value: 'Paris'
        },
        type: 'FILTER_FOR'
      };
      expect(toggleQueryFilterForPPL(queryString, filter)).toBe("search source=opensearch_dashboards_sample_data_flights | where `AvgTicketPrice` = 904");
    });
    it('should remove a positive filter if a negative filter is passed, then add the negative filter', () => {
      const queryString = "search source=opensearch_dashboards_sample_data_flights | where `AvgTicketPrice` = 904 | where `DestAirport` = 'Paris'"
      const filter: ToggleFilterAction = {
        options: {
          key: 'DestAirport',
          value: 'Paris'
        },
        type: 'FILTER_OUT'
      };
      expect(toggleQueryFilterForPPL(queryString, filter)).toBe("search source=opensearch_dashboards_sample_data_flights | where `AvgTicketPrice` = 904 | where `DestAirport` != 'Paris'");
    });
  });
}) 
