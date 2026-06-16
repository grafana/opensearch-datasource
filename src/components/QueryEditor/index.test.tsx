import React from 'react';
import { LuceneQueryType, OpenSearchQuery, QueryType } from '../../types';

import { fireEvent, render, screen } from '@testing-library/react';
import { QueryEditor } from '.';
import { OpenSearchDatasource } from '../../opensearchDatasource';
import userEvent from '@testing-library/user-event';
import { sampleQueries } from './SampleQueries/sampleQueries';

// prevent act() warnings
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: jest.fn().mockImplementation(() => {
    return <input data-testid="opensearch-fake-editor"></input>;
  }),
}));

const mockDatasource = {
  getSupportedQueryTypes: () => [QueryType.Lucene, QueryType.PPL],
} as OpenSearchDatasource;
const mockOnChange = jest.fn();
const mockRunQuery = jest.fn();

describe('QueryEditorForm', () => {
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
    const sampleQuery = sampleQueries[0].queryString;

    await userEvent.click(screen.getByTestId('sample-query-0'));
    expect(mockOnChange).toHaveBeenCalledWith({
      ...query,
      query: sampleQuery,
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
