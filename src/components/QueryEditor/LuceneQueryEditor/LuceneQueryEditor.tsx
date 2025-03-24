import { InlineSegmentGroup, InlineField, InlineSwitch, Input, InlineFieldRow } from '@grafana/ui';
import { useNextId } from 'hooks/useNextId';
import React from 'react';
import { LuceneQueryType, OpenSearchQuery } from 'types';
import { BucketAggregationsEditor } from '../BucketAggregationsEditor';
import { MetricAggregationsEditor } from '../MetricAggregationsEditor';
import { QueryEditorRow } from '../QueryEditorRow';
import { LuceneQueryTypeSelector } from './LuceneQueryTypeSelector';
import { EditorRows } from '@grafana/plugin-ui';

type LuceneQueryEditorProps = {
  query: OpenSearchQuery;
  onChange: (query: OpenSearchQuery) => void;
};

export const LuceneQueryEditor = (props: LuceneQueryEditorProps) => {
  const luceneQueryType = props.query.luceneQueryType || LuceneQueryType.Metric;
  const serviceMapSet = props.query.serviceMap || false;
  const nextId = useNextId();

  return (
    <EditorRows>
      <QueryEditorRow label={`Lucene Query Type`} disableRemove={true}>
        <InlineSegmentGroup>
          <LuceneQueryTypeSelector onChange={props.onChange} />
        </InlineSegmentGroup>
      </QueryEditorRow>
      {props.query.luceneQueryType === LuceneQueryType.Traces && (
        <InlineFieldRow>
          <InlineSegmentGroup>
            <InlineField label="Service Map" tooltip={'Request and display service map data for trace(s)'}>
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
            {!serviceMapSet && (
              <InlineField label="Size" tooltip={'Maximum returned traces. Defaults to 1000, maximum value of 10000'}>
                <Input
                  data-testid="span-limit-input"
                  placeholder="1000"
                  defaultValue={props.query.tracesSize}
                  onBlur={(event) => {
                    const newVal = event.target.value;
                    props.onChange({
                      ...props.query,
                      tracesSize: newVal,
                    });
                  }}
                />
              </InlineField>
            )}
          </InlineSegmentGroup>
        </InlineFieldRow>
      )}
      {shouldHaveMetricAggs(luceneQueryType) && <MetricAggregationsEditor nextId={nextId} />}
      {shouldHaveBucketAggs(luceneQueryType) && <BucketAggregationsEditor nextId={nextId} />}
    </EditorRows>
  );
};

const shouldHaveBucketAggs = (luceneQueryType: LuceneQueryType): boolean => {
  return luceneQueryType === LuceneQueryType.Metric;
};
const shouldHaveMetricAggs = (luceneQueryType: LuceneQueryType): boolean => {
  return luceneQueryType !== LuceneQueryType.Traces;
};
