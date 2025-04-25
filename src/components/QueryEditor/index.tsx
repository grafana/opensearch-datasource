import React from 'react';
import { QueryEditorProps } from '@grafana/data';
import { OpenSearchDatasource } from '../../opensearchDatasource';
import { OpenSearchOptions, OpenSearchQuery, QueryType } from '../../types';
import { OpenSearchProvider } from './OpenSearchQueryContext';
import { InlineField, InlineFieldRow, Input, QueryField } from '@grafana/ui';
import { changeAliasPattern, changeQuery } from './state';
import { QueryTypeEditor } from './QueryTypeEditor';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { css } from '@emotion/css';
import { PPLFormatEditor } from './PPLFormatEditor';
import { LuceneQueryEditor } from './LuceneQueryEditor/LuceneQueryEditor';
import { isTimeSeriesQuery } from 'utils';

export type OpenSearchQueryEditorProps = QueryEditorProps<OpenSearchDatasource, OpenSearchQuery, OpenSearchOptions>;

export const QueryEditor = ({ query, onChange, onRunQuery, datasource }: OpenSearchQueryEditorProps) => (
  <OpenSearchProvider datasource={datasource} onChange={onChange} query={query}>
    <QueryEditorForm value={query} onChange={onChange} onRunQuery={onRunQuery} />
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
  onRunQuery: () => void;
}

export const QueryEditorForm = ({ value, onChange, onRunQuery }: Props) => {
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
              onRunQuery={onRunQuery}
              onChange={(query) => dispatch(changeQuery(query))}
              placeholder={value.queryType === QueryType.PPL ? 'PPL Query' : 'Lucene Query'}
              portalOrigin="opensearch"
            />
          </div>
        </InlineField>
        {isTimeSeriesQuery(value) && (
          <InlineField
            label="Alias"
            tooltip="Aliasing only works for timeseries queries (when the last group is 'Date Histogram'). For all other query types this field is ignored."
            labelWidth={15}
            htmlFor="alias-input"
          >
            <Input
              id="alias-input"
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
