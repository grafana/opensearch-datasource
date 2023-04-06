import { InlineField, InlineFieldRow, Input } from '@grafana/ui';
import React from 'react';
import { OpenSearchQuery } from 'types';
import { getDefaultTraceListQuery, getSingleTraceQuery, getTraceIdFromQuery } from './traceQueries';

type Props = {
  onChange: (query: OpenSearchQuery) => void;
  query: OpenSearchQuery;
};

export const TracesQueryEditor = (props: Props) => {
  const currentTrace = getTraceIdFromQuery(props.query);
  return (
    <InlineFieldRow>
      <InlineField
        label="Trace Id"
        htmlFor="trace-input"
        labelWidth={17}
        tooltip={'Optional, defaults to all traces'}
        grow
      >
        <Input
          id="trace-input"
          placeholder="trace id"
          onBlur={e => {
            const traceId = e.target.value;
            const newQuery = traceId ? getSingleTraceQuery(traceId) : getDefaultTraceListQuery();
            props.onChange({
              ...props.query,
              ...newQuery,
            });
          }}
          defaultValue={currentTrace}
        />
      </InlineField>
    </InlineFieldRow>
  );
};
