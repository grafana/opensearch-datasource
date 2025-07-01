import React, { useCallback, useRef } from 'react';

import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

import { CodeEditor, Monaco } from '@grafana/ui';

import { OpenSearchQuery } from 'types';
import { MonacoCodeEditorProps } from './types';
import { css } from '@emotion/css';
import { registerLanguage, reRegisterCompletionProvider } from 'language/monarch/register';
import openSearchPPLLanguageDefinition from 'language/ppl/definition';
import { language } from 'language/ppl/language';

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

  const monacoRef = useRef<Monaco>();
  const disposalRef = useRef<monacoType.IDisposable>();

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

  const onBeforeEditorMount = async (monaco: Monaco) => {
    monacoRef.current = monaco;
    disposalRef.current = await registerLanguage(monaco, openSearchPPLLanguageDefinition, {
      // @ts-ignore
      getCompletionProvider: () => {
        return null;
      },
    });
  };

  const onFocus = useCallback(async () => {
    disposalRef.current = await reRegisterCompletionProvider(
      monacoRef.current!,
      openSearchPPLLanguageDefinition,
      {
        // @ts-ignore
        getCompletionProvider: () => {
          return null;
        },
      },
      disposalRef.current
    );
  }, []);

  return (
    <CodeEditor
      data-testid="ppl-query-field"
      onBeforeEditorMount={onBeforeEditorMount}
      onFocus={onFocus}
      containerStyles={css({ width: '100%' })}
      {...codeEditorBaseProps}
      language={language.id}
      value={query.query ?? ''}
      onBlur={(value: string) => {
        if (value !== query.query) {
          onChangeQuery(value);
        }
      }}
      onEditorWillUnmount={() => disposalRef.current?.dispose()}
    />
  );
};
