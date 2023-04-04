import { toOption } from '@grafana/data';
import { Segment } from '@grafana/ui';
import { useNextId } from 'hooks/useNextId';
import React, { useState } from 'react';
import { LuceneQueryType, OpenSearchQuery } from 'types';
import { BucketAggregationsEditor } from '../BucketAggregationsEditor';
import { MetricAggregationsEditor } from '../MetricAggregationsEditor';
import { QueryEditorRow } from '../QueryEditorRow';
import { segmentStyles } from '../styles';
import { getDefaultTraceListQuery } from '../TracesQueryEditor/traceQueries';
import { TracesQueryEditor } from '../TracesQueryEditor/TracesQueryEditor';

type LuceneEditorOptionProps = {
  luceneQueryType: LuceneQueryType;
  query: OpenSearchQuery;
  onChange: (query: OpenSearchQuery) => void;
};

const LuceneEditorOption = (props: LuceneEditorOptionProps) => {
  const nextId = useNextId();

  switch (props.luceneQueryType) {
    case LuceneQueryType.Traces:
      return <TracesQueryEditor onChange={props.onChange} query={props.query} />;
    default:
      return (
        <>
          <MetricAggregationsEditor nextId={nextId} />
          <BucketAggregationsEditor nextId={nextId} />
        </>
      );
  }
};

type LuceneQueryEditorProps = {
  query: OpenSearchQuery;
  onChange: (query: OpenSearchQuery) => void;
};

export const LuceneQueryEditor = (props: LuceneQueryEditorProps) => {
  const luceneQueryType = props.query.luceneQueryType || LuceneQueryType.Metric;
  const [selectedQueryType, setQueryType] = useState<LuceneQueryType>(luceneQueryType);

  const setDefaultQuery = (newQueryType: LuceneQueryType) => {
    if (newQueryType === LuceneQueryType.Traces) {
      const defaultTracesQuery = getDefaultTraceListQuery();
      return props.onChange({
        ...props.query,
        ...defaultTracesQuery,
      });
    }

    return props.onChange({
      ...props.query,
      luceneQueryType: newQueryType,
      luceneQueryObj: undefined,
    });
  };

  return (
    <>
      <QueryEditorRow label={`Lucene Query Type`} disableRemove={true}>
        <Segment
          className={segmentStyles}
          options={Object.values(LuceneQueryType).map(toOption)}
          onChange={val => {
            const newQueryType = LuceneQueryType[val.value];
            setQueryType(newQueryType);
            setDefaultQuery(newQueryType);
          }}
          value={toOption(selectedQueryType)}
        />
      </QueryEditorRow>
      <LuceneEditorOption luceneQueryType={selectedQueryType} onChange={props.onChange} query={props.query} />
    </>
  );
};
