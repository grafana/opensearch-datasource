import React from 'react';
import { QueryEditorProps } from '@grafana/data';
import { OpenSearchDatasource } from '../../datasource';
import { OpenSearchOptions, ElasticsearchQuery, ElasticsearchQueryType } from '../../types';
import { ElasticsearchProvider } from './ElasticsearchQueryContext';
import { LuceneEditor } from './LuceneEditor';
import { PPLEditor } from './PPLEditor';

type OpenSearchQueryEditorProps = QueryEditorProps<OpenSearchDatasource, ElasticsearchQuery, OpenSearchOptions>;

export const QueryEditor = ({ query, onChange, datasource }: OpenSearchQueryEditorProps) => (
  <ElasticsearchProvider datasource={datasource} onChange={onChange} query={query}>
    <QueryEditorForm value={query} />
  </ElasticsearchProvider>
);

interface Props {
  value: ElasticsearchQuery;
}

export const QueryEditorForm = ({ value }: Props) => {
  const { queryType } = value;

  switch (queryType) {
    case ElasticsearchQueryType.PPL:
      return <PPLEditor query={value.query} />;
    default:
      return <LuceneEditor query={value.query} />;
  }
};
