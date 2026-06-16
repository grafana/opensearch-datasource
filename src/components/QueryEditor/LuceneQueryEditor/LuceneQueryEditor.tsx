import { InlineSegmentGroup, InlineField, InlineSwitch, Input, InlineFieldRow, QueryField } from '@grafana/ui';
import { useNextId } from 'hooks/useNextId';
import React from 'react';
import { LuceneQueryType, OpenSearchQuery } from 'types';
import { BucketAggregationsEditor } from '../BucketAggregationsEditor';
import { MetricAggregationsEditor } from '../MetricAggregationsEditor';
import { LuceneQueryTypeSelector } from './LuceneQueryTypeSelector';
import { EditorField, EditorRow, EditorRows } from '@grafana/plugin-ui';
import { useDispatch } from 'hooks/useStatelessReducer';
import { changeQuery } from '../state';

type LuceneQueryEditorProps = {
  query: OpenSearchQuery;
  onChange: (query: OpenSearchQuery) => void;
  onRunQuery?: () => void;
};

export const LuceneQueryEditor = ({ query, onChange, onRunQuery }: LuceneQueryEditorProps) => {
  const luceneQueryType = query.luceneQueryType || LuceneQueryType.Metric;
  const serviceMapSet = query.serviceMap || false;
  const nextId = useNextId();
  const dispatch = useDispatch();

  return (
    <EditorRows>
      <EditorRow>
        <EditorField label="Lucene query" width="100%">
          <QueryField
            data-testid="lucene-query-editor-row"
            key={query.queryType}
            query={query.query}
            // By default QueryField calls onChange if onBlur is not defined, this will trigger a rerender
            // And slate will claim the focus, making it impossible to leave the field.
            onBlur={() => {}}
            onRunQuery={onRunQuery}
            onChange={(query) => dispatch(changeQuery(query))}
            placeholder="Lucene Query"
            portalOrigin="opensearch"
          />
        </EditorField>
      </EditorRow>
      <EditorRow>
        <LuceneQueryTypeSelector onChange={onChange} />
      </EditorRow>
      {query.luceneQueryType === LuceneQueryType.Traces && (
        <InlineFieldRow>
          <InlineSegmentGroup>
            <InlineField label="Service Map" tooltip={'Request and display service map data for trace(s)'}>
              <InlineSwitch
                value={query.serviceMap || false}
                onChange={(event) => {
                  const newVal = event.currentTarget.checked;
                  onChange({
                    ...query,
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
                  defaultValue={query.tracesSize}
                  onBlur={(event) => {
                    const newVal = event.target.value;
                    onChange({
                      ...query,
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
