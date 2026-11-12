import React, { useRef } from 'react';
import { QueryEditorProps } from '@grafana/data';
import { CodeEditor, Monaco, monacoTypes } from '@grafana/ui';
import { registerLanguage } from 'language/monarch/register';
import language from 'language/sql/definition';
import type { OpenSearchDatasource } from '../opensearchDatasource';
import { OpenSearchOptions, OpenSearchQuery } from '../types';
import { SQLVariableQuery } from '../variables';

type Props = QueryEditorProps<OpenSearchDatasource, OpenSearchQuery, OpenSearchOptions, SQLVariableQuery>;

/**
 * The editor of a query variable. A variable is a list of values, so the query
 * has to return the values in its first column.
 */
export const VariableQueryEditor = ({ query, onChange, datasource }: Props) => {
  const value = typeof query?.query === 'string' ? query.query : '';
  const update = (text: string) => onChange({ ...query, refId: query?.refId ?? 'A', query: text });
  const disposalRef = useRef<monacoTypes.IDisposable>();

  const onBeforeEditorMount = async (monaco: Monaco) => {
    // The language is registered per editor and released on unmount, so the
    // highlighting and the suggestions work in the variable editor too.
    disposalRef.current = await registerLanguage(monaco, language, datasource.sqlCompletionItemProvider);
  };

  return (
    <CodeEditor
      height={100}
      language={language.id}
      value={value}
      onBeforeEditorMount={onBeforeEditorMount}
      onBlur={update}
      onSave={update}
      showMiniMap={false}
      showLineNumbers={true}
      aria-label="SQL query for the variable values"
    />
  );
};
