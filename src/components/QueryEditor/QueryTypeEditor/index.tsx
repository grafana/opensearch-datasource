import React from 'react';
import { Segment } from '@grafana/ui';
import { useDatasource } from '../OpenSearchQueryContext';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { changeQueryType } from './state';
import { queryTypeConfig, getQueryTypeOptions } from './utils';
import { segmentStyles } from '../styles';
import { QueryType } from '../../../types';

const toOption = (queryType: QueryType) => {
  return {
    label: queryTypeConfig[queryType].label,
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
      onChange={e => dispatch(changeQueryType(e.value!))}
      value={toOption(value)}
    />
  );
};
