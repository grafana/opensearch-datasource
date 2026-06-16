import React from 'react';

import { InlineFieldRow, InlineLabel, InlineSegmentGroup } from '@grafana/ui';

import { SettingsEditor } from './SettingsEditor';
import { MetricAggregation } from './aggregations';

type Props = {
  name: string;
  metric: MetricAggregation;
  info?: string;
};

export const SpecialMetricAggregationsRow = ({ name, metric, info }: Props) => {
  // this widget is only used in scenarios when there is only a single
  // metric, so the array of "previousMetrics" (meaning all the metrics
  // before the current metric), is an empty-array
  const previousMetrics: MetricAggregation[] = [];

  return (
    <InlineFieldRow>
      <InlineSegmentGroup>
        <InlineLabel width={17} as="div">
          <span>{name}</span>
        </InlineLabel>
      </InlineSegmentGroup>
      <SettingsEditor metric={metric} previousMetrics={previousMetrics} />
      {info != null && (
        <InlineSegmentGroup>
          <InlineLabel>{info}</InlineLabel>
        </InlineSegmentGroup>
      )}
    </InlineFieldRow>
  );
};
