import { MetricFindValue, SelectableValue } from '@grafana/data';
import { Segment, SegmentAsync, useTheme, InlineSegmentGroup } from '@grafana/ui';
import { cx } from '@emotion/css';
import React from 'react';
import { useDatasource, useQuery } from '../OpenSearchQueryContext';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { getStyles } from './styles';
import { SettingsEditor } from './SettingsEditor';
import { MetricAggregationAction } from './state/types';
import { metricAggregationConfig } from './utils';
import { changeMetricField, changeMetricType } from './state/actions';
import { MetricPicker } from '../../MetricPicker';
import { segmentStyles } from '../styles';
import {
  isMetricAggregationWithField,
  isMetricAggregationWithSettings,
  isPipelineAggregation,
  isPipelineAggregationWithMultipleBucketPaths,
  MetricAggregation,
  MetricAggregationType,
} from './aggregations';
import { satisfies } from 'semver';
import { Flavor } from 'types';

const toOption = (metric: MetricAggregation) => ({
  label: metricAggregationConfig[metric.type].label,
  value: metric.type,
});

// @ts-ignore
const toSelectableValue = ({ value, text }: MetricFindValue): SelectableValue<string> => ({
  label: text,
  value: `${value || text}`,
});

interface Props {
  value: MetricAggregation;
}

// If a metric is a Pipeline Aggregation (https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-pipeline.html)
// it doesn't make sense to show it in the type picker when there is no non-pipeline-aggregation previously selected
// as they work on the outputs produced from other aggregations rather than from documents or fields.
// This means we should filter them out from the type picker if there's no other "basic" aggregation before the current one.
const isBasicAggregation = (metric: MetricAggregation) => !metricAggregationConfig[metric.type].isPipelineAgg;

const getTypeOptions = (
  previousMetrics: MetricAggregation[],
  flavor: Flavor,
  version: string
): Array<SelectableValue<MetricAggregationType>> => {
  // we'll include Pipeline Aggregations only if at least one previous metric is a "Basic" one
  const includePipelineAggregations = previousMetrics.some(isBasicAggregation);

  return (
    Object.entries(metricAggregationConfig)
      // Only showing metrics type supported by the configured version of OpenSearch
      .filter(([_, { versionRange }]) => satisfies(version, versionRange?.[flavor] || '*'))
      // Filtering out Pipeline Aggregations if there's no basic metric selected before
      .filter(([_, config]) => includePipelineAggregations || !config.isPipelineAgg)
      .map(([key, { label }]) => ({
        label,
        value: key as MetricAggregationType,
      }))
  );
};

export const MetricEditor = ({ value }: Props) => {
  const styles = getStyles(useTheme(), !!value.hide);
  const datasource = useDatasource();
  const query = useQuery();
  const dispatch = useDispatch<MetricAggregationAction>();

  const previousMetrics = query.metrics!.slice(
    0,
    query.metrics!.findIndex(m => m.id === value.id)
  );

  // TODO: This could be common with the one in BucketAggregationEditor
  const getFields = async () => {
    const get = () => {
      if (value.type === 'cardinality') {
        return datasource.getFields();
      }
      return datasource.getFields('number');
    };

    return (await get()).map(toSelectableValue);
  };

  return (
    <>
      <InlineSegmentGroup>
        <Segment
          className={cx(styles.color, segmentStyles)}
          options={getTypeOptions(previousMetrics, datasource.flavor, datasource.version)}
          onChange={e => dispatch(changeMetricType(value.id, e.value!))}
          value={toOption(value)}
        />

        {isMetricAggregationWithField(value) && !isPipelineAggregation(value) && (
          <SegmentAsync
            className={cx(styles.color, segmentStyles)}
            loadOptions={getFields}
            onChange={e => dispatch(changeMetricField(value.id, e.value!))}
            placeholder="Select Field"
            value={value.field}
          />
        )}

        {isPipelineAggregation(value) && !isPipelineAggregationWithMultipleBucketPaths(value) && (
          <MetricPicker
            className={cx(styles.color, segmentStyles)}
            onChange={e => dispatch(changeMetricField(value.id, e.value?.id!))}
            options={previousMetrics}
            value={value.field}
          />
        )}
      </InlineSegmentGroup>
      {isMetricAggregationWithSettings(value) && <SettingsEditor metric={value} previousMetrics={previousMetrics} />}
    </>
  );
};
