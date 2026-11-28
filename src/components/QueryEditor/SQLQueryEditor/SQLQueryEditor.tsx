import React, { useEffect } from 'react';
import { InlineField, InlineSwitch } from '@grafana/ui';
import { EditorRow } from '@grafana/plugin-ui';
import { SQLQueryField } from './SQLQueryField';
import { useQuery } from '../OpenSearchQueryContext';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { OpenSearchQuery } from 'types';
import { FormatEditor } from '../PPLQueryEditor/PPLFormatEditor/FormatEditor';
import { defaultPPLFormat } from 'query_def';
import { changeUseTimeRange } from './state';

export const SQLQueryEditor = ({ onChange }: { onChange: (query: OpenSearchQuery) => void }) => {
  const query = useQuery();
  const dispatch = useDispatch();

  // The editor shows a default format and seeds a starter query for a query that has
  // neither, so the query has to carry both as well. Otherwise the request has no
  // format — the response is then parsed as a time series regardless of what the
  // editor shows — and no query at all, which reads the whole index.
  //
  // Both defaults are written in one call because each `onChange` replaces the whole
  // query with the object it was called with. Written separately, the second call
  // would spread an object that predates the first and drop what it had set.
  useEffect(() => {
    if (!query.format || !query.query) {
      onChange({
        ...query,
        format: query.format || defaultPPLFormat(),
        query: query.query || `SELECT * FROM ${query.index || 'your_index'} LIMIT 10`,
      });
    }
  }, [query, onChange]);

  return (
    <>
      <EditorRow>
        <FormatEditor format={query.format ?? defaultPPLFormat()} />
        <InlineField
          label="Use time range"
          tooltip="Adds the dashboard time range to the query as a filter on the configured time field. Disable if your query already filters on time."
          interactive
        >
          <InlineSwitch
            id={`OS-query-${query.refId}-use-time-range`}
            value={query.useTimeRange ?? true}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch(changeUseTimeRange(e.target.checked))}
          />
        </InlineField>
      </EditorRow>
      <EditorRow>
        <SQLQueryField query={query} onChange={onChange} />
      </EditorRow>
    </>
  );
};
