import { QueryType, QueryTypeConfiguration } from '../../../types';
import { ComboboxOption } from '@grafana/ui';

export const queryTypeConfig: QueryTypeConfiguration = {
  [QueryType.Lucene]: { label: 'Lucene' },
  [QueryType.PPL]: { label: 'PPL' },
};

export const getQueryTypeOptions = (supportedTypes: QueryType[]): Array<ComboboxOption<QueryType>> => {
  return Object.entries(queryTypeConfig)
    .filter(([queryType, _]) => supportedTypes.includes(queryType as QueryType))
    .map(([key, { label }]) => ({
      label,
      value: key as QueryType,
    }));
};
