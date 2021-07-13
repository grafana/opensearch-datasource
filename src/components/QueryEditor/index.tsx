import React from 'react';
import { QueryEditorProps } from '@grafana/data';
import { OpenSearchDatasource } from '../../datasource';
import { OpenSearchOptions, OpenSearchQuery, QueryType } from '../../types';
import { ElasticsearchProvider } from './ElasticsearchQueryContext';
import { LuceneEditor } from './LuceneEditor';
import { PPLEditor } from './PPLEditor';

type OpenSearchQueryEditorProps = QueryEditorProps<OpenSearchDatasource, OpenSearchQuery, OpenSearchOptions>;

export const QueryEditor = ({ query, onChange, datasource }: OpenSearchQueryEditorProps) => (
  <ElasticsearchProvider datasource={datasource} onChange={onChange} query={query}>
    <QueryEditorForm value={query} />
  </ElasticsearchProvider>
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
