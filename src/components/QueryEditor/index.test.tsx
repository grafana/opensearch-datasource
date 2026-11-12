import React from 'react';
import { LuceneQueryType, OpenSearchQuery, QueryType } from '../../types';

import { fireEvent, render, screen } from '@testing-library/react';
import { QueryEditor } from '.';
import { OpenSearchDatasource } from '../../opensearchDatasource';
import userEvent from '@testing-library/user-event';
import { getSampleQueries } from './SampleQueries/sampleQueries';

// prevent act() warnings
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: jest.fn().mockImplementation(() => {
    return <input data-testid="opensearch-fake-editor"></input>;
  }),
}));

const mockDatasource = {
  getSupportedQueryTypes: () => [QueryType.Lucene, QueryType.PPL, QueryType.SQL],
  getIndices: jest.fn().mockResolvedValue([]),
  index: 'default-index',
  timeField: '@timestamp',
} as unknown as OpenSearchDatasource;
const mockOnChange = jest.fn();
const mockRunQuery = jest.fn();

describe('QueryEditorForm', () => {
  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('should render LuceneEditor given Lucene queryType', async () => {
    let query: OpenSearchQuery = {
      refId: 'A',
      query: '',
      queryType: QueryType.Lucene,
      metrics: [{ type: 'count', id: '2' }],
      bucketAggs: [{ type: 'date_histogram', id: '1' }],
    };

    render(<QueryEditor query={query} onChange={mockOnChange} onRunQuery={mockRunQuery} datasource={mockDatasource} />);

    expect(screen.getByText('Lucene query')).toBeInTheDocument();
    expect(screen.queryByTestId('opensearch-fake-editor')).not.toBeInTheDocument();
  });

  it('should render PPLEditor given PPL queryType', async () => {
    let query: OpenSearchQuery = {
      refId: 'A',
      query: '',
      queryType: QueryType.PPL,
      metrics: [{ type: 'count', id: '2' }],
      bucketAggs: [{ type: 'date_histogram', id: '1' }],
    };

    render(<QueryEditor query={query} onChange={mockOnChange} onRunQuery={mockRunQuery} datasource={mockDatasource} />);

    expect(screen.getByTestId('opensearch-fake-editor')).toBeInTheDocument();
    expect(screen.queryByText('Lucene query')).not.toBeInTheDocument();
  });

  it('should render SQLQueryEditor given SQL queryType', async () => {
    let query: OpenSearchQuery = {
      refId: 'A',
      query: '',
      queryType: QueryType.SQL,
      metrics: [{ type: 'count', id: '2' }],
      bucketAggs: [{ type: 'date_histogram', id: '1' }],
    };

    render(<QueryEditor query={query} onChange={mockOnChange} onRunQuery={mockRunQuery} datasource={mockDatasource} />);

    expect(screen.getByTestId('opensearch-fake-editor')).toBeInTheDocument();
    expect(screen.queryByText('Lucene query')).not.toBeInTheDocument();
  });

  it('should toggle useTimeRange in the SQL editor', async () => {
    const query: OpenSearchQuery = {
      refId: 'A',
      query: 'SELECT * FROM index',
      queryType: QueryType.SQL,
      metrics: [{ type: 'count', id: '2' }],
      bucketAggs: [{ type: 'date_histogram', id: '1' }],
      useTimeRange: true,
    };

    render(<QueryEditor query={query} onChange={mockOnChange} onRunQuery={mockRunQuery} datasource={mockDatasource} />);

    const useTimeRangeSwitch = screen.getByLabelText('Use time range');
    expect(useTimeRangeSwitch).toBeChecked();

    await userEvent.click(useTimeRangeSwitch);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ useTimeRange: false }));
  });

  it('should write the default format into a SQL query that does not set one', async () => {
    const query: OpenSearchQuery = {
      refId: 'A',
      query: 'SELECT * FROM index',
      queryType: QueryType.SQL,
      metrics: [{ type: 'count', id: '2' }],
      bucketAggs: [{ type: 'date_histogram', id: '1' }],
    };

    render(<QueryEditor query={query} onChange={mockOnChange} onRunQuery={mockRunQuery} datasource={mockDatasource} />);

    // The editor shows the table format, so the query has to carry it as well.
    // Without it the backend falls back to the time series format and the panel
    // fails with `response should have 2 fields`.
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ format: 'table' }));
  });

  it('should not overwrite the format of a SQL query that sets one', async () => {
    const query: OpenSearchQuery = {
      refId: 'A',
      query: 'SELECT * FROM index',
      queryType: QueryType.SQL,
      format: 'time_series',
      metrics: [{ type: 'count', id: '2' }],
      bucketAggs: [{ type: 'date_histogram', id: '1' }],
    };

    render(<QueryEditor query={query} onChange={mockOnChange} onRunQuery={mockRunQuery} datasource={mockDatasource} />);

    expect(mockOnChange).not.toHaveBeenCalledWith(expect.objectContaining({ format: 'table' }));
  });

  it('should not render Kickstart query button if queryType is Lucene', () => {
    let query: OpenSearchQuery = {
      refId: 'A',
      query: '',
      queryType: QueryType.Lucene,
      metrics: [{ type: 'count', id: '2' }],
      bucketAggs: [{ type: 'date_histogram', id: '1' }],
    };
    render(<QueryEditor query={query} onChange={mockOnChange} onRunQuery={mockRunQuery} datasource={mockDatasource} />);
    expect(screen.queryByTestId('sample-query-button')).not.toBeInTheDocument();
  });

  it('should render sample queries if Kickstart query button is clicked', async () => {
    let query: OpenSearchQuery = {
      refId: 'A',
      query: '',
      queryType: QueryType.PPL,
      metrics: [{ type: 'count', id: '2' }],
      bucketAggs: [{ type: 'date_histogram', id: '1' }],
    };

    render(<QueryEditor query={query} onChange={mockOnChange} onRunQuery={mockRunQuery} datasource={mockDatasource} />);

    const button = screen.getByTestId('sample-query-button');
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(screen.getByText('Sample queries')).toBeInTheDocument();
  });

  it('should update query with the selected sample query', async () => {
    let query: OpenSearchQuery = {
      refId: 'A',
      query: '',
      queryType: QueryType.PPL,
      metrics: [{ type: 'count', id: '2' }],
      bucketAggs: [{ type: 'date_histogram', id: '1' }],
    };
    render(<QueryEditor query={query} onChange={mockOnChange} onRunQuery={mockRunQuery} datasource={mockDatasource} />);
    const button = screen.getByTestId('sample-query-button');
    await userEvent.click(button);
    const sampleQuery = getSampleQueries(QueryType.PPL)[0].queryString;

    await userEvent.click(screen.getByTestId('sample-query-0'));
    expect(mockOnChange).toHaveBeenCalledWith({
      ...query,
      query: sampleQuery,
    });
  });

  it('should show the SQL sample queries when SQL is selected', async () => {
    const query: OpenSearchQuery = {
      refId: 'A',
      query: '',
      queryType: QueryType.SQL,
      metrics: [{ type: 'count', id: '2' }],
      bucketAggs: [{ type: 'date_histogram', id: '1' }],
    };
    render(<QueryEditor query={query} onChange={mockOnChange} onRunQuery={mockRunQuery} datasource={mockDatasource} />);

    await userEvent.click(screen.getByTestId('sample-query-button'));

    const sqlSampleQueries = getSampleQueries(QueryType.SQL);
    expect(sqlSampleQueries.length).toBeGreaterThan(0);
    sqlSampleQueries.forEach((sampleQuery, i) => {
      expect(screen.getByTestId(`sample-query-${i}`).textContent).toBe(sampleQuery.queryString);
    });

    // None of the PPL samples may show up for a SQL query.
    const pplSampleQueries = getSampleQueries(QueryType.PPL);
    pplSampleQueries.forEach((sampleQuery, i) => {
      expect(screen.getByTestId(`sample-query-${i}`).textContent).not.toBe(sampleQuery.queryString);
    });
  });

  it('should update the query with the selected SQL sample query', async () => {
    const query: OpenSearchQuery = {
      refId: 'A',
      query: '',
      queryType: QueryType.SQL,
      metrics: [{ type: 'count', id: '2' }],
      bucketAggs: [{ type: 'date_histogram', id: '1' }],
    };
    render(<QueryEditor query={query} onChange={mockOnChange} onRunQuery={mockRunQuery} datasource={mockDatasource} />);

    await userEvent.click(screen.getByTestId('sample-query-button'));
    await userEvent.click(screen.getByTestId('sample-query-0'));

    expect(mockOnChange).toHaveBeenCalledWith({
      ...query,
      query: getSampleQueries(QueryType.SQL)[0].queryString,
    });
  });

  describe('Alias field', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    it('Should correctly render and trigger changes on blur', () => {
      const alias = '{{metric}}';
      const query: OpenSearchQuery = {
        refId: 'A',
        query: '',
        alias,
        metrics: [
          {
            id: '1',
            type: 'count',
          },
        ],
        bucketAggs: [
          {
            type: 'date_histogram',
            id: '2',
          },
        ],
      };

      render(
        <QueryEditor query={query} onChange={mockOnChange} onRunQuery={mockRunQuery} datasource={mockDatasource} />
      );

      let aliasField = screen.getByLabelText('Alias') as HTMLInputElement;

      // The Query should have an alias field
      expect(aliasField).toBeInTheDocument();

      // its value should match the one in the query
      expect(aliasField.value).toBe(alias);

      // We change value and trigger a blur event to trigger an update
      const newAlias = 'new alias';
      fireEvent.change(aliasField, { target: { value: newAlias } });
      fireEvent.blur(aliasField);

      // the onChange handler should have been called correctly, and the resulting
      // query state should match what expected
      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange.mock.calls[0][0].alias).toBe(newAlias);
    });

    it('Should not be shown if query is Lucene Traces', () => {
      const query: OpenSearchQuery = {
        refId: 'A',
        query: '',
        luceneQueryType: LuceneQueryType.Traces,
        metrics: [
          {
            id: '1',
            type: 'avg',
          },
        ],
        bucketAggs: [{ id: '2', type: 'terms' }],
      };

      render(
        <QueryEditor query={query} datasource={mockDatasource} onChange={mockOnChange} onRunQuery={mockRunQuery} />
      );

      expect(screen.queryByLabelText('Alias')).toBeNull();
    });
    it('Should not be shown if query is PPL', () => {
      const query: OpenSearchQuery = {
        refId: 'A',
        query: '',
        queryType: QueryType.PPL,
      };

      render(
        <QueryEditor query={query} datasource={mockDatasource} onChange={mockOnChange} onRunQuery={mockRunQuery} />
      );

      expect(screen.queryByLabelText('Alias')).toBeNull();
    });

    it('Should not be shown if last bucket aggregation is not Date Histogram', () => {
      const query: OpenSearchQuery = {
        refId: 'A',
        query: '',
        metrics: [
          {
            id: '1',
            type: 'avg',
          },
        ],
        bucketAggs: [{ id: '2', type: 'terms' }],
      };

      render(
        <QueryEditor query={query} datasource={mockDatasource} onChange={mockOnChange} onRunQuery={mockRunQuery} />
      );

      expect(screen.queryByLabelText('Alias')).toBeNull();
    });

    it('Should be shown if last bucket aggregation is Date Histogram', () => {
      const query: OpenSearchQuery = {
        refId: 'A',
        query: '',
        metrics: [
          {
            id: '1',
            type: 'avg',
          },
        ],
        bucketAggs: [
          { id: '1', type: 'geohash_grid' },
          { id: '2', type: 'date_histogram' },
        ],
      };

      render(
        <QueryEditor query={query} datasource={mockDatasource} onChange={mockOnChange} onRunQuery={mockRunQuery} />
      );

      expect(screen.getByLabelText('Alias')).toBeEnabled();
    });
  });
});
