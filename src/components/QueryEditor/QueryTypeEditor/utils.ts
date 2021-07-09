import { SelectableValue } from '@grafana/data';
import { ElasticsearchQueryType, QueryTypeConfiguration } from '../../../types';

export const queryTypeConfig: QueryTypeConfiguration = {
  [ElasticsearchQueryType.Lucene]: { label: 'Lucene' },
  [ElasticsearchQueryType.PPL]: { label: 'PPL' },
};

export const getQueryTypeOptions = (
  supportedTypes: ElasticsearchQueryType[]
): Array<SelectableValue<ElasticsearchQueryType>> => {
  return Object.entries(queryTypeConfig)
    .filter(([queryType, _]) => supportedTypes.includes(queryType as ElasticsearchQueryType))
    .map(([key, { label }]) => ({
      label,
      value: key as ElasticsearchQueryType,
    }));
};
