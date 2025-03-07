import React from 'react';
import { LuceneQueryType, OpenSearchQuery, QueryType } from '../../types';

import { fireEvent, render, screen } from '@testing-library/react';
import { QueryEditor } from '.';
import { OpenSearchDatasource } from '../../opensearchDatasource';

const mockDatasource = {
  getSupportedQueryTypes: () => [QueryType.Lucene, QueryType.PPL],
} as OpenSearchDatasource;
const mockOnChange = jest.fn();
const mockRunQuery = jest.fn();

// Slate seems to cause an error without this, getSelection is not present in the current jsDom version.
(window as any).getSelection = () => {};

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

    expect(screen.getByText('Lucene')).toBeInTheDocument();
    expect(screen.queryByText('PPL')).not.toBeInTheDocument();
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

    expect(screen.getByText('PPL')).toBeInTheDocument();
    expect(screen.queryByText('Lucene')).not.toBeInTheDocument();
  });

  describe('Alias field', () => {
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
        bucketAggs: [{ id: '2', type: 'date_histogram' }],
      };

      render(
        <QueryEditor query={query} datasource={mockDatasource} onChange={mockOnChange} onRunQuery={mockRunQuery} />
      );

      expect(screen.getByLabelText('Alias')).toBeEnabled();
    });
  });
});
