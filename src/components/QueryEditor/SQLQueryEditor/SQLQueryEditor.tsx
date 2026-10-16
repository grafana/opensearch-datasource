import React from 'react';
import { SQLQueryField } from './SQLQueryField';
import { useQuery } from '../OpenSearchQueryContext';
import { OpenSearchQuery } from 'types';
import { EditorRow } from '@grafana/plugin-ui';
import { FormatEditor } from '../PPLQueryEditor/PPLFormatEditor/FormatEditor';
import { defaultPPLFormat } from 'query_def';

export const SQLQueryEditor = ({ onChange }: { onChange: (query: OpenSearchQuery) => void }) => {
  const query = useQuery();
  return (
    <>
      <EditorRow>
        <FormatEditor format={query.format ?? defaultPPLFormat()} />
      </EditorRow>
      <EditorRow>
        <SQLQueryField query={query} onChange={onChange} />
      </EditorRow>
    </>
  );
};
