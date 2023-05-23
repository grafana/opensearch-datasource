import { InlineField, Input, Switch, Select } from '@grafana/ui';
import React, { ComponentProps, useState } from 'react';
import { extendedStats } from '../../../../query_def';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { changeMetricMeta, changeMetricSetting } from '../state/actions';
import {
  MetricAggregation,
  isMetricAggregationWithInlineScript,
  isMetricAggregationWithMissingSupport,
  ExtendedStat,
} from '../aggregations';
import { BucketScriptSettingsEditor } from './BucketScriptSettingsEditor';
import { SettingField } from './SettingField';
import { SettingsEditorContainer } from '../../SettingsEditorContainer';
import { useDescription } from './useDescription';
import { MovingAverageSettingsEditor } from './MovingAverageSettingsEditor';
import { uniqueId } from 'lodash';
import { metricAggregationConfig, orderOptions } from '../utils';
import { useQuery } from '../../OpenSearchQueryContext';

// TODO: Move this somewhere and share it with BucketsAggregation Editor
const inlineFieldProps: Partial<ComponentProps<typeof InlineField>> = {
  labelWidth: 16,
};

interface Props {
  metric: MetricAggregation;
  previousMetrics: MetricAggregation[];
}

export const SettingsEditor = ({ metric, previousMetrics }: Props) => {
  const dispatch = useDispatch();
  const description = useDescription(metric);
  const query = useQuery();

  return (
    <SettingsEditorContainer label={description} hidden={metric.hide}>
      {metric.type === 'derivative' && <SettingField label="Unit" metric={metric} settingName="unit" />}

      {metric.type === 'cumulative_sum' && <SettingField label="Format" metric={metric} settingName="format" />}

      {metric.type === 'moving_avg' && <MovingAverageSettingsEditor metric={metric} />}

      {metric.type === 'moving_fn' && (
        <>
          <SettingField label="Window" metric={metric} settingName="window" />
          <SettingField label="Script" metric={metric} settingName="script" />
          <SettingField label="Shift" metric={metric} settingName="shift" />
        </>
      )}

      {metric.type === 'bucket_script' && (
        <BucketScriptSettingsEditor value={metric} previousMetrics={previousMetrics} />
      )}

      {(metric.type === 'raw_data' || metric.type === 'raw_document') && (
        <>
          <InlineField label="Size" {...inlineFieldProps}>
            <Input
              id={`ES-query-${query.refId}_metric-${metric.id}-size`}
              onBlur={e => dispatch(changeMetricSetting(metric, 'size', e.target.value))}
              defaultValue={metric.settings?.size ?? metricAggregationConfig['raw_data'].defaults.settings?.size}
            />
          </InlineField>
          <InlineField label="Use time range" {...inlineFieldProps}>
            <Switch
              id={`ES-query-${query.refId}_metric-${metric.id}-use-time-range`}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                dispatch(changeMetricSetting(metric, 'useTimeRange', e.target.checked))
              }
              value={metric.settings?.useTimeRange}
            />
          </InlineField>
          {metric.settings?.useTimeRange && (
            <InlineField label="Order">
              <Select
                id={`ES-query-${query.refId}_metric-${metric.id}-order`}
                options={orderOptions}
                onChange={e => dispatch(changeMetricSetting(metric, 'order', e.value))}
                value={metric.settings?.order || 'desc'}
              />
            </InlineField>
          )}
        </>
      )}

      {metric.type === 'cardinality' && (
        <SettingField label="Precision Threshold" metric={metric} settingName="precision_threshold" />
      )}

      {metric.type === 'extended_stats' && (
        <>
          {extendedStats.map(stat => (
            <ExtendedStatSetting
              key={stat.value}
              stat={stat}
              onChange={checked => dispatch(changeMetricMeta(metric, stat.value, checked))}
              value={
                metric.meta?.[stat.value] !== undefined
                  ? !!metric.meta?.[stat.value]
                  : !!metricAggregationConfig['extended_stats'].defaults.meta?.[stat.value]
              }
            />
          ))}

          <SettingField label="Sigma" metric={metric} settingName="sigma" placeholder="3" />
        </>
      )}

      {metric.type === 'percentiles' && (
        <InlineField label="Percentiles" {...inlineFieldProps}>
          <Input
            onBlur={e => dispatch(changeMetricSetting(metric, 'percents', e.target.value.split(',').filter(Boolean)))}
            defaultValue={
              metric.settings?.percents || metricAggregationConfig['percentiles'].defaults.settings?.percents
            }
            placeholder="1,5,25,50,75,95,99"
          />
        </InlineField>
      )}

      {isMetricAggregationWithInlineScript(metric) && (
        <SettingField label="Script" metric={metric} settingName="script" placeholder="_value * 1" />
      )}

      {isMetricAggregationWithMissingSupport(metric) && (
        <SettingField
          label="Missing"
          metric={metric}
          settingName="missing"
          tooltip="The missing parameter defines how documents that are missing a value should be treated. By default
            they will be ignored but it is also possible to treat them as if they had a value"
        />
      )}
    </SettingsEditorContainer>
  );
};

interface ExtendedStatSettingProps {
  stat: ExtendedStat;
  onChange: (checked: boolean) => void;
  value: boolean;
}
const ExtendedStatSetting = ({ stat, onChange, value }: ExtendedStatSettingProps) => {
  // this is needed for the htmlFor prop in the label so that clicking the label will toggle the switch state.
  const [id] = useState(uniqueId(`es-field-id-`));

  return (
    <InlineField label={stat.label} {...inlineFieldProps} key={stat.value}>
      <Switch id={id} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)} value={value} />
    </InlineField>
  );
};
