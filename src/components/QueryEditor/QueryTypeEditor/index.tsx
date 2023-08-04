import React from 'react';
import { Segment } from '@grafana/ui';
import { useDatasource } from '../OpenSearchQueryContext';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { changeQueryType } from './state';
import { queryTypeConfig, getQueryTypeOptions } from './utils';
import { segmentStyles } from '../styles';
import { QueryType } from '../../../types';

const isValidQueryType = (t: string): t is QueryType => {
  return Object.values(QueryType).includes(t as QueryType);
};
const toOption = (queryType: QueryType) => {
  const config = queryTypeConfig[queryType];
  if (!config) {
    return { label: 'Invalid query type', value: '' };
  }
  return {
    label: config.label,
    value: queryType,
  };
};

interface Props {
  value: QueryType;
}

export const QueryTypeEditor = ({ value }: Props) => {
  const datasource = useDatasource();
  const dispatch = useDispatch();

  return (
    <Segment
      className={segmentStyles}
      options={getQueryTypeOptions(datasource.getSupportedQueryTypes())}
      onChange={e => {
        isValidQueryType(e.value) && dispatch(changeQueryType(e.value!));
      }}
      value={toOption(value)}
    />
  );
};
