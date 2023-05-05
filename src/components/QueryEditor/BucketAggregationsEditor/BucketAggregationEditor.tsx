import { MetricFindValue, SelectableValue } from '@grafana/data';
import { Segment, SegmentAsync, InlineSegmentGroup } from '@grafana/ui';
import React from 'react';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { useDatasource } from '../OpenSearchQueryContext';
import { segmentStyles } from '../styles';
import { BucketAggregation, BucketAggregationType, isBucketAggregationWithField } from './aggregations';
import { SettingsEditor } from './SettingsEditor';
import { changeBucketAggregationField, changeBucketAggregationType } from './state/actions';
import { BucketAggregationAction } from './state/types';
import { bucketAggregationConfig } from './utils';

const bucketAggOptions: Array<SelectableValue<BucketAggregationType>> = Object.entries(bucketAggregationConfig).map(
  ([key, { label }]) => ({
    label,
    value: key as BucketAggregationType,
  })
);

// @ts-ignore
const toSelectableValue = ({ value, text }: MetricFindValue): SelectableValue<string> => ({
  label: text,
  value: `${value || text}`,
});

const toOption = (bucketAgg: BucketAggregation) => ({
  label: bucketAggregationConfig[bucketAgg.type].label,
  value: bucketAgg.type,
});

interface Props {
  value: BucketAggregation;
}

export const BucketAggregationEditor = ({ value }: Props) => {
  const datasource = useDatasource();
  const dispatch = useDispatch<BucketAggregationAction>();

  // TODO: Move this in a separate hook (and simplify)
  const getFields = async () => {
    const get = () => {
      switch (value.type) {
        case 'date_histogram':
          return datasource.getFields('date');
        case 'geohash_grid':
          return datasource.getFields('geo_point');
        default:
          return datasource.getFields();
      }
    };

    return (await get()).map(toSelectableValue);
  };

  return (
    <>
      <InlineSegmentGroup>
        <Segment
          className={segmentStyles}
          options={bucketAggOptions}
          onChange={e => dispatch(changeBucketAggregationType(value.id, e.value!))}
          value={toOption(value)}
        />

        {isBucketAggregationWithField(value) && (
          <SegmentAsync
            className={segmentStyles}
            loadOptions={getFields}
            onChange={e => dispatch(changeBucketAggregationField(value.id, e.value))}
            placeholder="Select Field"
            value={value.field}
          />
        )}
        <SettingsEditor bucketAgg={value} />
      </InlineSegmentGroup>
    </>
  );
};
