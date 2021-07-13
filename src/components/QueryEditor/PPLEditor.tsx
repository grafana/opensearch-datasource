import React from 'react';
import { ElasticsearchQuery, QueryType } from '../../types';
import { InlineField, InlineFieldRow, QueryField } from '@grafana/ui';
import { QueryTypeEditor } from './QueryTypeEditor';
import { PPLFormatEditor } from './PPLFormatEditor';
import { changeQuery } from './state';
import { useDispatch } from '../../hooks/useStatelessReducer';

interface Props {
  query: ElasticsearchQuery['query'];
}

export const PPLEditor = ({ query }: Props) => {
  const dispatch = useDispatch();

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Query" labelWidth={17} grow>
          <>
            <QueryTypeEditor value={QueryType.PPL} />
            <QueryField
              query={query}
              onBlur={() => {}}
              onChange={query => dispatch(changeQuery(query))}
              placeholder="PPL Query"
              portalOrigin="elasticsearch"
            />
          </>
        </InlineField>
      </InlineFieldRow>
      <PPLFormatEditor />
    </>
  );
};
