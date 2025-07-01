import React, { useCallback } from 'react';

import { CodeEditor } from '@grafana/ui';

import { OpenSearchQuery } from 'types';
import { MonacoCodeEditorProps } from './types';
import { css } from '@emotion/css';

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
      language="ppl"
      value={query.query ?? ''}
      onBlur={(value: string) => {
        if (value !== query.query) {
          onChangeQuery(value);
        }
      }}
    />
  );
};
