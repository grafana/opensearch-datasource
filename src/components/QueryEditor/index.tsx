import React, { FunctionComponent } from 'react';
import { QueryEditorProps } from '@grafana/data';
import { ElasticDatasource } from '../../datasource';
import { ElasticsearchOptions, ElasticsearchQuery, ElasticsearchQueryType } from '../../types';
import { ElasticsearchProvider } from './ElasticsearchQueryContext';
import { LuceneEditor } from './LuceneEditor';
import { PPLEditor } from './PPLEditor';
// Fix for https://github.com/grafana/grafana/issues/26512
import {} from '@emotion/core';

export type ElasticQueryEditorProps = QueryEditorProps<ElasticDatasource, ElasticsearchQuery, ElasticsearchOptions>;

export const QueryEditor: FunctionComponent<ElasticQueryEditorProps> = ({ query, onChange, datasource }) => (
  <ElasticsearchProvider datasource={datasource} onChange={onChange} query={query}>
    <QueryEditorForm value={query} />
  </ElasticsearchProvider>
);

interface Props {
  value: ElasticsearchQuery;
}

export const QueryEditorForm: FunctionComponent<Props> = ({ value }) => {
  const { queryType } = value;

  switch (queryType) {
    case ElasticsearchQueryType.PPL:
      return <PPLEditor query={value.query} />;
    default:
      return <LuceneEditor query={value.query} />;
  }
};
