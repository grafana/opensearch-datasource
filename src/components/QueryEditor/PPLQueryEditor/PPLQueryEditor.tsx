import React from 'react';
import { PPLQueryField } from './PPLQueryField';
import { useQuery } from '../OpenSearchQueryContext';
import { OpenSearchQuery } from 'types';
import { EditorRow } from '@grafana/plugin-ui';
import { FormatEditor } from './PPLFormatEditor/FormatEditor';
import { defaultPPLFormat } from 'query_def';

export const PPLQueryEditor = ({ onChange }: { onChange: (query: OpenSearchQuery) => void }) => {
  const query = useQuery();
  return (
    <>
      <EditorRow>
        <FormatEditor format={query.format ?? defaultPPLFormat()} />
      </EditorRow>
      <EditorRow>
        <PPLQueryField query={query} onChange={onChange} />
      </EditorRow>
    </>
  );
};
