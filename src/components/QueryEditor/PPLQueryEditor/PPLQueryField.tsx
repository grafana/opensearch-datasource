import React, { useCallback, useRef } from 'react';

import { CodeEditor, Monaco, monacoTypes } from '@grafana/ui';

import { OpenSearchQuery } from 'types';
import { MonacoCodeEditorProps } from './types';
import { css } from '@emotion/css';
import { registerLanguage, reRegisterCompletionProvider } from 'language/monarch/register';
import language from 'language/ppl/definition';
import { useDatasource } from '../OpenSearchQueryContext';
import { TRIGGER_SUGGEST } from 'language/monarch/commands';
import { useEffectOnce } from 'react-use';

const defaultPPLQuery = 'source = your_index LIMIT 10';
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

  const monacoRef = useRef<Monaco>();
  const disposalRef = useRef<monacoTypes.IDisposable>();

  useEffectOnce(() => {
    if (!query.query) {
      onChange({
        ...query,
        query: defaultPPLQuery,
      });
    }
  });

  const onFocus = useCallback(async () => {
    disposalRef.current = await reRegisterCompletionProvider(
      monacoRef.current!,
      language,
      datasource.pplCompletionItemProvider,
      disposalRef.current
    );
  }, [datasource]);

  const onEditorMount = useCallback(
    (editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editor.onDidFocusEditorText(() => editor.trigger(TRIGGER_SUGGEST.id, TRIGGER_SUGGEST.id, {}));
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
    monacoRef.current = monaco;
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
        disposalRef.current?.dispose();
      }}
      onFocus={onFocus}
      onBeforeEditorMount={onBeforeEditorMount}
      onEditorDidMount={onEditorMount}
      onEditorWillUnmount={() => disposalRef.current?.dispose()}
    />
  );
};
