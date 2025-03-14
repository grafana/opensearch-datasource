import React from 'react';
import { QueryEditorProps } from '@grafana/data';
import { OpenSearchDatasource } from '../../opensearchDatasource';
import { LuceneQueryType, OpenSearchOptions, OpenSearchQuery, QueryType } from '../../types';
import { OpenSearchProvider } from './OpenSearchQueryContext';
import { InlineField, InlineFieldRow, Input, QueryField } from '@grafana/ui';
import { changeAliasPattern, changeQuery } from './state';
import { QueryTypeEditor } from './QueryTypeEditor';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { css } from '@emotion/css';
import { PPLFormatEditor } from './PPLFormatEditor';
import { LuceneQueryEditor } from './LuceneQueryEditor/LuceneQueryEditor';

export type OpenSearchQueryEditorProps = QueryEditorProps<OpenSearchDatasource, OpenSearchQuery, OpenSearchOptions>;

export const QueryEditor = ({ query, onChange, datasource }: OpenSearchQueryEditorProps) => (
  <OpenSearchProvider datasource={datasource} onChange={onChange} query={query}>
    <QueryEditorForm value={query} onChange={onChange} />
  </OpenSearchProvider>
);

const styles = {
  queryWrapper: css`
    display: flex;
    flex-grow: 1;
  `,
};
interface Props {
  value: OpenSearchQuery;
  onChange: (query: OpenSearchQuery) => void;
}

export const QueryEditorForm = ({ value, onChange }: Props) => {
  const dispatch = useDispatch();

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Query" labelWidth={17} grow>
          <div className={styles.queryWrapper}>
            <QueryTypeEditor value={value.queryType || QueryType.Lucene} />
            <QueryField
              key={value.queryType}
              query={value.query}
              // By default QueryField calls onChange if onBlur is not defined, this will trigger a rerender
              // And slate will claim the focus, making it impossible to leave the field.
              onBlur={() => {}}
              onChange={(query) => dispatch(changeQuery(query))}
              placeholder={value.queryType === QueryType.PPL ? 'PPL Query' : 'Lucene Query'}
              portalOrigin="opensearch"
            />
          </div>
        </InlineField>
        {value.queryType !== QueryType.PPL && value.luceneQueryType !== LuceneQueryType.Traces && (
          <InlineField label="Alias" labelWidth={15}>
            <Input
              placeholder="Alias Pattern"
              onBlur={(e) => dispatch(changeAliasPattern(e.currentTarget.value))}
              defaultValue={value.alias}
            />
          </InlineField>
        )}
      </InlineFieldRow>

      {value.queryType === QueryType.PPL ? (
        <PPLFormatEditor />
      ) : (
        <LuceneQueryEditor query={value} onChange={onChange} />
      )}
    </>
  );
};
