import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';

import React from 'react';
import { MetricAggregation } from '../MetricAggregationsEditor/aggregations';
import { LuceneQueryType, OpenSearchQuery } from 'types';
import { useQuery } from '../OpenSearchQueryContext';
import { useDispatch } from 'hooks/useStatelessReducer';
import { metricAggregationConfig } from '../MetricAggregationsEditor/utils';
import { updateLuceneTypeAndMetrics } from './state';
import { getNewMetrics } from '../MetricAggregationsEditor/state/reducer';

const OPTIONS: Array<SelectableValue<LuceneQueryType>> = [
  { value: LuceneQueryType.Metric, label: 'Metric' },
  { value: LuceneQueryType.Logs, label: 'Logs' },
  { value: LuceneQueryType.RawData, label: 'Raw Data' },
  { value: LuceneQueryType.RawDocument, label: 'Raw Document' },
  { value: LuceneQueryType.Traces, label: 'Traces' },
];

function queryTypeToMetricType(type: LuceneQueryType): MetricAggregation['type'] {
  switch (type) {
    case LuceneQueryType.Logs:
      return 'logs';
    case LuceneQueryType.Metric:
      return 'count';
    case LuceneQueryType.RawData:
      return 'raw_data';
    case LuceneQueryType.RawDocument:
      return 'raw_document';
    default:
      // should never happen
      throw new Error(`Query type ${type} does not have a corresponding metric aggregation`);
  }
}

export const LuceneQueryTypeSelector = (props: { onChange: (query: OpenSearchQuery) => void }) => {
  const query = useQuery();
  const dispatch = useDispatch();

  const firstMetric = query.metrics?.[0];

  if (firstMetric == null) {
    // not sure if this can really happen, but we should handle it anyway
    return null;
  }

  const queryType =
    query.luceneQueryType === LuceneQueryType.Traces
      ? LuceneQueryType.Traces
      : metricAggregationConfig[firstMetric.type].impliedLuceneQueryType;

  const onChangeQueryType = (newQueryType: LuceneQueryType) => {
    if (newQueryType !== LuceneQueryType.Traces) {
      dispatch(
        updateLuceneTypeAndMetrics({
          luceneQueryType: newQueryType,
          metrics: getNewMetrics(query.metrics || [], firstMetric.id, queryTypeToMetricType(newQueryType)),
        })
      );
    } else {
      props.onChange({ ...query, luceneQueryType: newQueryType });
    }
  };

  return (
    <RadioButtonGroup<LuceneQueryType>
      fullWidth={false}
      options={OPTIONS}
      value={queryType}
      onChange={onChangeQueryType}
    />
  );
};
