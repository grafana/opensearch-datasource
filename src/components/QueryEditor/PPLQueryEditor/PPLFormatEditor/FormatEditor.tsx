import React from 'react';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { changeFormat } from './state';

import { EditorField } from '@grafana/plugin-ui';
import { HelpMessage } from './HelpMessage';
import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

export type PPLFormatType = 'table' | 'logs' | 'time_series';

const formatOptions: Array<SelectableValue<PPLFormatType>> = [
  { label: 'Table', value: 'table' },
  { label: 'Logs', value: 'logs' },
  { label: 'Time series', value: 'time_series' },
];

interface Props {
  format: PPLFormatType;
}

export const FormatEditor = ({ format }: Props) => {
  const dispatch = useDispatch();

  return (
    <EditorField htmlFor="format-select" label="Format" tooltip={<HelpMessage />} tooltipInteractive={true}>
      <Select
        data-testid="format-select"
        options={formatOptions}
        onChange={(e) => dispatch(changeFormat(e.value))}
        value={format}
      />
    </EditorField>
  );
};
