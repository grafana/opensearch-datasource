import React from 'react';
import { Combobox } from '@grafana/ui';
import { useDatasource } from '../OpenSearchQueryContext';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { changeQueryType } from './state';
import { getQueryTypeOptions } from './utils';
import { QueryType } from '../../../types';
import { EditorField } from '@grafana/plugin-ui';

const isValidQueryType = (t?: string): t is QueryType => {
  return Object.values(QueryType).includes(t as QueryType);
};

interface Props {
  value: QueryType;
}

export const QueryTypeEditor = ({ value }: Props) => {
  const datasource = useDatasource();
  const dispatch = useDispatch();

  return (
    <EditorField label="Query type" htmlFor="query-type">
      <Combobox
        id="query-type"
        data-testid="query-type-select"
        options={getQueryTypeOptions(datasource.getSupportedQueryTypes())}
        value={value || QueryType.Lucene}
        onChange={(e) => {
          isValidQueryType(e.value) && dispatch(changeQueryType(e.value!));
        }}
      />
    </EditorField>
  );
};
