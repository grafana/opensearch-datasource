import React, { FunctionComponent } from 'react';
import { ElasticsearchQuery, ElasticsearchQueryType } from '../../types';
import { InlineField, InlineFieldRow, QueryField } from '@grafana/ui';
import { QueryTypeEditor } from './QueryTypeEditor';
import { PPLFormatEditor } from './PPLFormatEditor';
import { changeQuery } from './state';
import { useDispatch } from '../../hooks/useStatelessReducer';

interface Props {
  query: ElasticsearchQuery['query'];
}

export const PPLEditor: FunctionComponent<Props> = ({ query }) => {
  const dispatch = useDispatch();

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Query" labelWidth={17} grow>
          <>
            <QueryTypeEditor value={ElasticsearchQueryType.PPL} />
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
