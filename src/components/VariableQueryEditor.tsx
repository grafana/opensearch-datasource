import React, { useEffect, useRef, useState } from 'react';
import { QueryEditorProps } from '@grafana/data';
import { CodeEditor, InlineField, InlineSwitch, Monaco, TextArea, monacoTypes } from '@grafana/ui';
import { registerLanguage } from 'language/monarch/register';
import language from 'language/sql/definition';
import type { OpenSearchDatasource } from '../opensearchDatasource';
import { OpenSearchOptions, OpenSearchQuery, QueryType } from '../types';
import { extractQueryString, extractSQLQuery, SQLVariableQuery } from '../variables';

type Props = QueryEditorProps<OpenSearchDatasource, OpenSearchQuery, OpenSearchOptions, SQLVariableQuery>;

/**
 * The editor of a query variable.
 *
 * A variable written before this editor existed holds the JSON query that Lucene
 * and PPL variables use, in the same field a SQL variable uses for its SQL. The
 * editor therefore opens in the JSON mode and shows that query unchanged, so an
 * existing dashboard keeps working after an upgrade. The switch turns the
 * variable into a SQL one, which replaces the JSON query because the two are not
 * interchangeable.
 */
export const VariableQueryEditor = ({ query, onChange, datasource }: Props) => {
  const value = extractQueryString(query);
  const disposalRef = useRef<monacoTypes.IDisposable>();
  // The mode is the switch, not a property of the query: a SQL variable that has
  // not been written yet holds an empty query, which says nothing about its type.
  const [sqlMode, setSqlMode] = useState(extractSQLQuery(query) !== '');
  // The JSON query is edited in place, so the text is held until it is committed.
  const [jsonValue, setJsonValue] = useState(value);

  useEffect(() => {
    setJsonValue(value);
  }, [value]);

  const update = (text: string, isSQL = sqlMode) =>
    onChange({
      ...query,
      refId: query?.refId ?? 'A',
      // A JSON variable is left as it was, without a query type, so the target of
      // an existing dashboard is not rewritten just because it was opened.
      ...(isSQL ? { queryType: QueryType.SQL } : {}),
      query: text,
    });

  const switchMode = (isSQL: boolean) => {
    setSqlMode(isSQL);
    // A JSON query is not SQL, so switching replaces it rather than carrying it
    // over into a query that would not run.
    update('', isSQL);
  };

  const onBeforeEditorMount = async (monaco: Monaco) => {
    // The language is registered per editor and released on unmount, so the
    // highlighting and the suggestions work in the variable editor too.
    disposalRef.current = await registerLanguage(monaco, language, datasource.sqlCompletionItemProvider);
  };

  return (
    <>
      <InlineField
        label="Query type"
        htmlFor="variable-query-type"
        tooltip="A variable written before SQL support holds a JSON query. Turning SQL on replaces it with a SQL query, and the JSON query is lost."
      >
        <InlineSwitch id="variable-query-type" value={sqlMode} onChange={(e) => switchMode(e.currentTarget.checked)} />
      </InlineField>
      {sqlMode ? (
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
      ) : (
        <TextArea
          id="variable-query-json"
          value={jsonValue}
          onChange={(e) => setJsonValue(e.currentTarget.value)}
          onBlur={(e) => update(e.currentTarget.value)}
          rows={5}
          placeholder='{"find": "terms", "field": "@timestamp"}'
          aria-label="JSON query for the variable values"
        />
      )}
    </>
  );
};
