import React from 'react';
import { QueryEditorProps } from '@grafana/data';
import { OpenSearchDatasource } from '../../opensearchDatasource';
import { OpenSearchOptions, OpenSearchQuery, QueryType } from '../../types';
import { OpenSearchProvider } from './OpenSearchQueryContext';
import { Input } from '@grafana/ui';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { LuceneQueryEditor } from './LuceneQueryEditor/LuceneQueryEditor';
import { PPLQueryEditor } from './PPLQueryEditor/PPLQueryEditor';
import { EditorField, EditorRow } from '@grafana/plugin-ui';
import { isTimeSeriesQuery } from 'utils';
import { changeAliasPattern } from './state';
import { QueryTypeEditor } from './QueryTypeEditor';

export type OpenSearchQueryEditorProps = QueryEditorProps<OpenSearchDatasource, OpenSearchQuery, OpenSearchOptions>;

export const QueryEditor = ({ query, onChange, onRunQuery, datasource }: OpenSearchQueryEditorProps) => (
  <OpenSearchProvider datasource={datasource} onChange={onChange} query={query}>
    <QueryEditorForm value={query} onChange={onChange} onRunQuery={onRunQuery} />
  </OpenSearchProvider>
);

interface Props {
  value: OpenSearchQuery;
  onChange: (query: OpenSearchQuery) => void;
  onRunQuery: () => void;
}

export const QueryEditorForm = ({ value, onChange, onRunQuery }: Props) => {
  const dispatch = useDispatch();

  return (
    <>
      <EditorRow>
        <QueryTypeEditor value={value.queryType || QueryType.Lucene} />
        {isTimeSeriesQuery(value) && (
          <EditorField
            label="Alias"
            tooltip="Aliasing only works for timeseries queries (when the last group is 'Date Histogram'). For all other query types this field is ignored."
            htmlFor="alias-input"
          >
            <Input
              id="alias-input"
              placeholder="Alias Pattern"
              onBlur={(e) => dispatch(changeAliasPattern(e.currentTarget.value))}
              defaultValue={value.alias}
            />
          </EditorField>
        )}
      </EditorRow>
      {value.queryType === QueryType.Lucene ? (
        <LuceneQueryEditor query={value} onChange={onChange} onRunQuery={onRunQuery} />
      ) : (
        <PPLQueryEditor onChange={onChange} />
      )}
    </>
  );
};
