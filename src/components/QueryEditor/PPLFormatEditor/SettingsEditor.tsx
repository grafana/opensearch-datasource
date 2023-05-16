import React from 'react';
import { SelectableValue } from '@grafana/data';
import { Segment, InlineSegmentGroup } from '@grafana/ui';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { changeFormat } from './state';
import { formatConfig } from './utils';
import { PPLFormatType } from './formats';
import { segmentStyles } from '../styles';

const queryTypeOptions: Array<SelectableValue<PPLFormatType>> = Object.entries(formatConfig).map(
  ([key, { label }]) => ({
    label,
    value: key as PPLFormatType,
  })
);

const toOption = (format: PPLFormatType) => ({
  label: formatConfig[format].label,
  value: format,
});

interface Props {
  value: PPLFormatType;
}

export const SettingsEditor = ({ value }: Props) => {
  const dispatch = useDispatch();

  return (
    <InlineSegmentGroup>
      <Segment
        className={segmentStyles}
        options={queryTypeOptions}
        onChange={e => dispatch(changeFormat(e.value!))}
        value={toOption(value)}
      />
    </InlineSegmentGroup>
  );
};
