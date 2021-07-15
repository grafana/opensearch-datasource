import React from 'react';
import { QueryEditorProps } from '@grafana/data';
import { OpenSearchDatasource } from '../../datasource';
import { OpenSearchOptions, OpenSearchQuery, QueryType } from '../../types';
import { OpenSearchProvider } from './OpenSearchQueryContext';
import { LuceneEditor } from './LuceneEditor';
import { PPLEditor } from './PPLEditor';

type OpenSearchQueryEditorProps = QueryEditorProps<OpenSearchDatasource, OpenSearchQuery, OpenSearchOptions>;

export const QueryEditor = ({ query, onChange, datasource }: OpenSearchQueryEditorProps) => (
  <OpenSearchProvider datasource={datasource} onChange={onChange} query={query}>
    <QueryEditorForm value={query} />
  </OpenSearchProvider>
);

interface Props {
  value: OpenSearchQuery;
}

export const QueryEditorForm = ({ value }: Props) => {
  const { queryType } = value;

  switch (queryType) {
    case QueryType.PPL:
      return <PPLEditor query={value.query} />;
    default:
      return <LuceneEditor query={value.query} />;
  }
};
