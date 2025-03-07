import React from 'react';
import { MetricEditor } from './MetricEditor';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { metricAggregationConfig } from './utils';
import { addMetric, removeMetric, toggleMetricVisibility } from './state/actions';
import { MetricAggregation } from './aggregations';
import { useQuery } from '../OpenSearchQueryContext';
import { QueryEditorRow } from '../QueryEditorRow';
import { IconButton } from '../../IconButton';
import { SpecialMetricAggregationsRow } from './SpecialMetricAggregationsRow';

interface Props {
  nextId: MetricAggregation['id'];
}

export const MetricAggregationsEditor = ({ nextId }: Props) => {
  const dispatch = useDispatch();
  const { metrics } = useQuery();
  const totalMetrics = metrics?.length || 0;

  return (
    <>
      {metrics?.map((metric, index) => {
        switch (metric.type) {
          case 'logs':
            return <SpecialMetricAggregationsRow key={`${metric.type}-${metric.id}`} name="Logs" metric={metric} />;
          case 'raw_data':
            return <SpecialMetricAggregationsRow key={`${metric.type}-${metric.id}`} name="Raw Data" metric={metric} />;
          case 'raw_document':
            return (
              <SpecialMetricAggregationsRow key={`${metric.type}-${metric.id}`} name="Raw Document" metric={metric} />
            );
          default:
            return (
              <QueryEditorRow
                key={metric.id}
                label={`Metric (${metric.id})`}
                hidden={metric.hide}
                onHideClick={() => dispatch(toggleMetricVisibility(metric.id))}
                onRemoveClick={() => dispatch(removeMetric(metric.id))}
                disableRemove={!(totalMetrics > 1)}
              >
                <MetricEditor value={metric} />

                {!metricAggregationConfig[metric.type].isSingleMetric && index === 0 && (
                  <IconButton iconName="plus" onClick={() => dispatch(addMetric(nextId))} label="add" />
                )}
              </QueryEditorRow>
            );
        }
      })}
    </>
  );
};
