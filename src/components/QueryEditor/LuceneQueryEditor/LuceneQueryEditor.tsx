import { toOption } from '@grafana/data';
import { Segment, InlineSegmentGroup } from '@grafana/ui';
import { useNextId } from 'hooks/useNextId';
import React from 'react';
import { LuceneQueryType, OpenSearchQuery } from 'types';
import { BucketAggregationsEditor } from '../BucketAggregationsEditor';
import { MetricAggregationsEditor } from '../MetricAggregationsEditor';
import { QueryEditorRow } from '../QueryEditorRow';
import { segmentStyles } from '../styles';

type LuceneQueryEditorProps = {
  query: OpenSearchQuery;
  onChange: (query: OpenSearchQuery) => void;
};

export const LuceneQueryEditor = (props: LuceneQueryEditorProps) => {
  const luceneQueryType = props.query.luceneQueryType || LuceneQueryType.Metric;
  const nextId = useNextId();

  const setLuceneQueryType = (newQueryType: LuceneQueryType) => {
    return props.onChange({
      ...props.query,
      luceneQueryType: newQueryType,
    });
  };

  return (
    <>
      <QueryEditorRow label={`Lucene Query Type`} disableRemove={true}>
        <InlineSegmentGroup>
          <Segment
            className={segmentStyles}
            options={Object.values(LuceneQueryType).map(toOption)}
            onChange={val => {
              const newQueryType = LuceneQueryType[val.value];
              setLuceneQueryType(newQueryType);
            }}
            value={toOption(luceneQueryType)}
          />
        </InlineSegmentGroup>
      </QueryEditorRow>
      {luceneQueryType === LuceneQueryType.Metric && (
        <>
          <MetricAggregationsEditor nextId={nextId} />
          <BucketAggregationsEditor nextId={nextId} />
        </>
      )}
    </>
  );
};
