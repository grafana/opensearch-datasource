import React, { useCallback, useEffect, useRef } from 'react';

import { CodeEditor, Monaco, monacoTypes } from '@grafana/ui';

import { OpenSearchQuery } from 'types';
import { MonacoCodeEditorProps } from '../PPLQueryEditor/types';
import { css } from '@emotion/css';
import { registerLanguage } from 'language/monarch/register';
import language from 'language/sql/definition';
import { useDatasource } from '../OpenSearchQueryContext';
import { HIDE_SUGGEST, TRIGGER_SUGGEST } from 'language/monarch/commands';
import { useEffectOnce } from 'react-use';

interface CodeEditorProps {
  query: OpenSearchQuery;
  onChange: (query: OpenSearchQuery) => void;
}

const codeEditorBaseProps: Partial<MonacoCodeEditorProps> = {
  height: '150px',
  width: '100%',
  showMiniMap: false,
  monacoOptions: {
    // without this setting, the auto-resize functionality causes an infinite loop, don't remove it!
    scrollBeyondLastLine: false,

    // These additional options are style focused and are a subset of those in the query editor in Prometheus
    fontSize: 14,
    renderLineHighlight: 'none',
    scrollbar: {
      vertical: 'hidden',
      horizontal: 'hidden',
    },
    suggestFontSize: 12,
    wordWrap: 'on',
    padding: {
      top: 6,
    },
  },
};
export const SQLQueryField = (props: CodeEditorProps) => {
  const { query, onChange } = props;
  const datasource = useDatasource();

  const disposalRef = useRef<monacoTypes.IDisposable>();
  const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor>();

  // The Shift+Enter command is registered once, on editor mount, so it has to read the latest
  // query through a ref. Closing over `query` instead would spread a stale object and silently
  // drop fields that change after mount — most notably the selected `format`. The ref is synced
  // in an effect rather than during render, which React forbids.
  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  // Keep the Monaco editor in sync when query.query is updated externally (e.g. by the IndexPicker)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const editorValue = editor.getValue();
    const stateValue = query.query ?? '';
    if (editorValue !== stateValue) {
      editor.setValue(stateValue);
    }
  }, [query.query]);

  useEffectOnce(() => {
    if (!query.query) {
      const indexName = query.index || 'your_index';
      onChange({
        ...query,
        query: `SELECT * FROM ${indexName} LIMIT 10`,
      });
    }
  });

  const onFocus = useCallback(() => {
    editorRef.current?.trigger(TRIGGER_SUGGEST.id, TRIGGER_SUGGEST.id, {});
  }, []);

  const onEditorMount = useCallback(
    (editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor;
      editor.onDidChangeModelContent(() => {
        const model = editor.getModel();
        if (model?.getValue().trim() === '') {
          editor.trigger(TRIGGER_SUGGEST.id, TRIGGER_SUGGEST.id, {});
        }
      });
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        const text = editor.getValue();
        onChange({
          ...queryRef.current,
          query: text,
        });
      });
    },
    [onChange]
  );
  const onBeforeEditorMount = async (monaco: Monaco) => {
    disposalRef.current = await registerLanguage(monaco, language, datasource.sqlCompletionItemProvider);
  };

  const onChangeQuery = useCallback(
    (value: string) => {
      const nextQuery = {
        ...query,
        query: value,
      };
      onChange(nextQuery);
    },
    [onChange, query]
  );

  return (
    <CodeEditor
      data-testid="sql-query-field"
      containerStyles={css({ width: '100%' })}
      {...codeEditorBaseProps}
      language={language.id}
      value={query.query ?? ''}
      onBlur={(value: string) => {
        if (value !== query.query) {
          onChangeQuery(value);
        }
        editorRef.current?.trigger(HIDE_SUGGEST.id, HIDE_SUGGEST.id, {});
      }}
      onFocus={onFocus}
      onBeforeEditorMount={onBeforeEditorMount}
      onEditorDidMount={onEditorMount}
      onEditorWillUnmount={() => disposalRef.current?.dispose()}
    />
  );
};
