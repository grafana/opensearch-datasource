import React from 'react';
import { OpenSearchQuery, QueryType } from '../../types';

import { render, screen } from '@testing-library/react';
import { QueryEditor } from '.';
import { OpenSearchDatasource } from '../../datasource';

const mockDatasource = {
  getSupportedQueryTypes: () => [QueryType.Lucene, QueryType.PPL],
} as OpenSearchDatasource;

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

    render(<QueryEditor query={query} onChange={q => (query = q)} onRunQuery={() => {}} datasource={mockDatasource} />);

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

    render(<QueryEditor query={query} onChange={q => (query = q)} onRunQuery={() => {}} datasource={mockDatasource} />);

    expect(screen.getByText('PPL')).toBeInTheDocument();
    expect(screen.queryByText('Lucene')).not.toBeInTheDocument();
  });
});
