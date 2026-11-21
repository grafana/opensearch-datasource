import { SelectableValue } from '@grafana/data';
import { QueryType, QueryTypeConfiguration } from '../../../types';

export const queryTypeConfig: QueryTypeConfiguration = {
  [QueryType.Lucene]: { label: 'Lucene' },
  [QueryType.PPL]: { label: 'PPL' },
  [QueryType.SQL]: { label: 'SQL' },
};

export const getQueryTypeOptions = (
  supportedTypes: QueryType[],
  currentType?: QueryType
): Array<SelectableValue<QueryType>> => {
  return Object.entries(queryTypeConfig)
    .filter(([queryType, _]) => supportedTypes.includes(queryType as QueryType) || queryType === currentType)
    .map(([key, { label }]) => ({
      // A query saved in a language that is now disabled keeps its type, and the label
      // says why it is not one of the choices, rather than looking like a normal one.
      label: supportedTypes.includes(key as QueryType) ? label : `${label} (disabled)`,
      value: key as QueryType,
    }));
};
