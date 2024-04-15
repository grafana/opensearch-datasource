import { Segment, InlineSegmentGroup, InlineField, InlineSwitch } from '@grafana/ui';
import { useNextId } from 'hooks/useNextId';
import React from 'react';
import { LuceneQueryType, OpenSearchQuery } from 'types';
import { BucketAggregationsEditor } from '../BucketAggregationsEditor';
import { MetricAggregationsEditor } from '../MetricAggregationsEditor';
import { QueryEditorRow } from '../QueryEditorRow';
import { segmentStyles } from '../styles';
import { config } from '@grafana/runtime';

type LuceneQueryEditorProps = {
  query: OpenSearchQuery;
  onChange: (query: OpenSearchQuery) => void;
};
const toOption = (queryType: LuceneQueryType) => {
  return {
    label: queryType,
    value: queryType,
  };
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
            onChange={(val) => {
              const newQueryType = val.value ? LuceneQueryType[val.value] : LuceneQueryType[luceneQueryType];
              setLuceneQueryType(newQueryType);
            }}
            value={toOption(luceneQueryType)}
          />
          {luceneQueryType === LuceneQueryType.Traces && (config.featureToggles as any)['openSearchNodeGraph'] && (
            <InlineField label="Service Map" tooltip={"Request and display service map data for trace(s)"}>
              <InlineSwitch
                value={props.query.serviceMap || false}
                onChange={(event) => {
                  const newVal = event.currentTarget.checked;
                  props.onChange({
                    ...props.query,
                    serviceMap: newVal,
                  });
                }}
              />
            </InlineField>
          )}
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
