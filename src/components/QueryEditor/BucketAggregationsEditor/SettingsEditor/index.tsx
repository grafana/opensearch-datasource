import { InlineField, Input, Select } from '@grafana/ui';
import React, { ComponentProps } from 'react';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { SettingsEditorContainer } from '../../SettingsEditorContainer';
import { changeBucketAggregationSetting } from '../state/actions';
import { BucketAggregation } from '../aggregations';
import {
  bucketAggregationConfig,
  createOrderByOptionsFromMetrics,
  intervalOptions,
  orderOptions,
  sizeOptions,
} from '../utils';
import { FiltersSettingsEditor } from './FiltersSettingsEditor';
import { useDescription } from './useDescription';
import { useQuery } from '../../OpenSearchQueryContext';

const inlineFieldProps: Partial<ComponentProps<typeof InlineField>> = {
  labelWidth: 16,
};

const executionHintOptions = [
  { label: 'Map', value: 'map' },
  { label: 'Global Ordinals', value: 'global_ordinals' },
];

interface Props {
  bucketAgg: BucketAggregation;
}

export const SettingsEditor = ({ bucketAgg }: Props) => {
  const dispatch = useDispatch();
  const { metrics } = useQuery();
  const settingsDescription = useDescription(bucketAgg);
  const orderBy = createOrderByOptionsFromMetrics(metrics);

  return (
    <SettingsEditorContainer label={settingsDescription}>
      {bucketAgg.type === 'terms' && (
        <>
          <InlineField label="Order" {...inlineFieldProps}>
            <Select
              onChange={(e) =>
                dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'order', newValue: e.value! }))
              }
              options={orderOptions}
              value={bucketAgg.settings?.order || bucketAggregationConfig[bucketAgg.type].defaultSettings?.order}
            />
          </InlineField>

          <InlineField label="Size" {...inlineFieldProps}>
            <Select
              onChange={(e) =>
                dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'size', newValue: e.value! }))
              }
              options={sizeOptions}
              value={bucketAgg.settings?.size || bucketAggregationConfig[bucketAgg.type].defaultSettings?.size}
              allowCustomValue
            />
          </InlineField>

          <InlineField
            label="Execution Hint"
            {...inlineFieldProps}
            tooltip="Determines how the aggregation should be executed. OpenSearch automatically chooses the optimal hint based on field type (global_ordinals for keyword fields, map for scripts) if not specified."
          >
            <Select
              data-testid="execution-hint-select"
              onChange={(e) =>
                dispatch(
                  changeBucketAggregationSetting({ bucketAgg, settingName: 'execution_hint', newValue: e.value! })
                )
              }
              options={executionHintOptions}
              value={bucketAgg.settings?.execution_hint}
              placeholder="Select execution hint"
            />
          </InlineField>

          <InlineField label="Min Doc Count" {...inlineFieldProps}>
            <Input
              onBlur={(e) =>
                dispatch(
                  changeBucketAggregationSetting({ bucketAgg, settingName: 'min_doc_count', newValue: e.target.value! })
                )
              }
              defaultValue={
                bucketAgg.settings?.min_doc_count ||
                bucketAggregationConfig[bucketAgg.type].defaultSettings?.min_doc_count
              }
            />
          </InlineField>

          <InlineField label="Order By" {...inlineFieldProps}>
            <Select
              onChange={(e) =>
                dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'orderBy', newValue: e.value! }))
              }
              options={orderBy}
              value={bucketAgg.settings?.orderBy || bucketAggregationConfig[bucketAgg.type].defaultSettings?.orderBy}
            />
          </InlineField>

          <InlineField label="Missing" {...inlineFieldProps}>
            <Input
              onBlur={(e) =>
                dispatch(
                  changeBucketAggregationSetting({ bucketAgg, settingName: 'missing', newValue: e.target.value! })
                )
              }
              defaultValue={
                bucketAgg.settings?.missing || bucketAggregationConfig[bucketAgg.type].defaultSettings?.missing
              }
            />
          </InlineField>
        </>
      )}

      {bucketAgg.type === 'geohash_grid' && (
        <InlineField label="Precision" {...inlineFieldProps}>
          <Input
            onBlur={(e) =>
              dispatch(
                changeBucketAggregationSetting({ bucketAgg, settingName: 'precision', newValue: e.target.value! })
              )
            }
            defaultValue={
              bucketAgg.settings?.precision || bucketAggregationConfig[bucketAgg.type].defaultSettings?.precision
            }
          />
        </InlineField>
      )}

      {bucketAgg.type === 'date_histogram' && (
        <>
          <InlineField label="Interval" {...inlineFieldProps}>
            <Select
              onChange={(e) =>
                dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'interval', newValue: e.value! }))
              }
              options={intervalOptions}
              value={bucketAgg.settings?.interval || bucketAggregationConfig[bucketAgg.type].defaultSettings?.interval}
              allowCustomValue
            />
          </InlineField>

          <InlineField label="Min Doc Count" {...inlineFieldProps}>
            <Input
              onBlur={(e) =>
                dispatch(
                  changeBucketAggregationSetting({ bucketAgg, settingName: 'min_doc_count', newValue: e.target.value! })
                )
              }
              defaultValue={
                bucketAgg.settings?.min_doc_count ||
                bucketAggregationConfig[bucketAgg.type].defaultSettings?.min_doc_count
              }
            />
          </InlineField>

          <InlineField label="Trim Edges" {...inlineFieldProps} tooltip="Trim the edges on the timeseries datapoints">
            <Input
              onBlur={(e) =>
                dispatch(
                  changeBucketAggregationSetting({ bucketAgg, settingName: 'trimEdges', newValue: e.target.value! })
                )
              }
              defaultValue={
                bucketAgg.settings?.trimEdges || bucketAggregationConfig[bucketAgg.type].defaultSettings?.trimEdges
              }
            />
          </InlineField>

          <InlineField
            label="Offset"
            {...inlineFieldProps}
            tooltip="Change the start value of each bucket by the specified positive (+) or negative offset (-) duration, such as 1h for an hour, or 1d for a day"
          >
            <Input
              onBlur={(e) =>
                dispatch(
                  changeBucketAggregationSetting({ bucketAgg, settingName: 'offset', newValue: e.target.value! })
                )
              }
              defaultValue={
                bucketAgg.settings?.offset || bucketAggregationConfig[bucketAgg.type].defaultSettings?.offset
              }
            />
          </InlineField>
        </>
      )}

      {bucketAgg.type === 'histogram' && (
        <>
          <InlineField label="Interval" {...inlineFieldProps}>
            <Input
              onBlur={(e) =>
                dispatch(
                  changeBucketAggregationSetting({ bucketAgg, settingName: 'interval', newValue: e.target.value! })
                )
              }
              defaultValue={
                bucketAgg.settings?.interval || bucketAggregationConfig[bucketAgg.type].defaultSettings?.interval
              }
            />
          </InlineField>

          <InlineField label="Min Doc Count" {...inlineFieldProps}>
            <Input
              onBlur={(e) =>
                dispatch(
                  changeBucketAggregationSetting({ bucketAgg, settingName: 'min_doc_count', newValue: e.target.value! })
                )
              }
              defaultValue={
                bucketAgg.settings?.min_doc_count ||
                bucketAggregationConfig[bucketAgg.type].defaultSettings?.min_doc_count
              }
            />
          </InlineField>
        </>
      )}

      {bucketAgg.type === 'filters' && <FiltersSettingsEditor value={bucketAgg} />}
    </SettingsEditorContainer>
  );
};
