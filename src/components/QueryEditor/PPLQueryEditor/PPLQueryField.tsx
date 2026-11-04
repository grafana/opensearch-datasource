import React, { useCallback, useEffect, useRef } from 'react';

import { CodeEditor, Monaco, monacoTypes } from '@grafana/ui';

import { OpenSearchQuery } from 'types';
import { MonacoCodeEditorProps } from './types';
import { css } from '@emotion/css';
import { registerLanguage } from 'language/monarch/register';
import language from 'language/ppl/definition';
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
export const PPLQueryField = (props: CodeEditorProps) => {
  const { query, onChange } = props;
  const datasource = useDatasource();

  const disposalRef = useRef<monacoTypes.IDisposable>();
  const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor>();

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
        query: `source = ${indexName} | HEAD 10`,
      });
    }
  });

  // Unlike CloudWatch PPL, our completion provider is not query-scoped, so keep it
  // registered across blur/focus. Disposing on blur and re-registering on focus races
  // Monaco's suggest widget and leaves it stuck on "Loading...". registerLanguage
  // ref-counts a single shared provider so multiple editors do not duplicate suggestions.
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
          ...query,
          query: text,
        });
      });
    },
    [onChange, query]
  );
  const onBeforeEditorMount = async (monaco: Monaco) => {
    disposalRef.current = await registerLanguage(monaco, language, datasource.pplCompletionItemProvider);
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
      data-testid="ppl-query-field"
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
