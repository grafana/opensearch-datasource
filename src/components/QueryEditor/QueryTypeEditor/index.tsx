import React, { FunctionComponent } from 'react';
import { Segment } from '@grafana/ui';
import { useDatasource } from '../ElasticsearchQueryContext';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { changeQueryType } from './state';
import { queryTypeConfig, getQueryTypeOptions } from './utils';
import { segmentStyles } from '../styles';
import { ElasticsearchQueryType } from '../../../types';

const toOption = (queryType: ElasticsearchQueryType) => ({
  label: queryTypeConfig[queryType].label,
  value: queryType,
});

interface Props {
  value: ElasticsearchQueryType;
}

export const QueryTypeEditor: FunctionComponent<Props> = ({ value }) => {
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
