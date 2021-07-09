import React, { FunctionComponent } from 'react';
import { ElasticsearchQuery, ElasticsearchQueryType } from '../../types';
import { InlineField, InlineFieldRow, Input, QueryField } from '@grafana/ui';
import { changeAliasPattern, changeQuery } from './state';
import { QueryTypeEditor } from './QueryTypeEditor';
import { MetricAggregationsEditor } from './MetricAggregationsEditor';
import { BucketAggregationsEditor } from './BucketAggregationsEditor';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { useNextId } from '../../hooks/useNextId';

interface Props {
  query: ElasticsearchQuery['query'];
}

export const LuceneEditor: FunctionComponent<Props> = ({ query }) => {
  const dispatch = useDispatch();
  const nextId = useNextId();

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Query" labelWidth={17} grow>
          <>
            <QueryTypeEditor value={ElasticsearchQueryType.Lucene} />
            <QueryField
              query={query}
              // By default QueryField calls onChange if onBlur is not defined, this will trigger a rerender
              // And slate will claim the focus, making it impossible to leave the field.
              onBlur={() => {}}
              onChange={query => dispatch(changeQuery(query))}
              placeholder="Lucene Query"
              portalOrigin="elasticsearch"
            />
          </>
        </InlineField>
        <InlineField label="Alias" labelWidth={15}>
          <Input placeholder="Alias Pattern" onBlur={e => dispatch(changeAliasPattern(e.currentTarget.value))} />
        </InlineField>
      </InlineFieldRow>
      <MetricAggregationsEditor nextId={nextId} />
      <BucketAggregationsEditor nextId={nextId} />
    </>
  );
};
