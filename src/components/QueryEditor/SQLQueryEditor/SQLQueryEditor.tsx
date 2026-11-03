import React from 'react';
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
