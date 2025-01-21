import { Segment, InlineSegmentGroup, InlineField, InlineSwitch, Input } from '@grafana/ui';
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
const toOption = (queryType: LuceneQueryType) => {
  return {
    label: queryType,
    value: queryType,
  };
};

export const LuceneQueryEditor = (props: LuceneQueryEditorProps) => {
  const luceneQueryType = props.query.luceneQueryType || LuceneQueryType.Metric;
  const serviceMapSet = props.query.serviceMap || false;
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
          {luceneQueryType === LuceneQueryType.Traces && (
            <>
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
                <InlineField
                  label="Span Limit"
                  tooltip={'Maximum returned spans. Defaults to 1000, maximum value of 10000'}
                >
                  <Input
                    data-testid="span-limit-input"
                    placeholder="1000"
                    defaultValue={props.query.spanLimit}
                    onBlur={(event) => {
                      const newVal = event.target.value;
                      props.onChange({
                        ...props.query,
                        spanLimit: newVal,
                      });
                    }}
                  />
                </InlineField>
              )}
            </>
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
