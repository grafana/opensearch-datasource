import React from 'react';
import { Combobox, ComboboxOption } from '@grafana/ui';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { changeFormat } from './state';

import { EditorField } from '@grafana/plugin-ui';
import { HelpMessage } from './HelpMessage';

export type PPLFormatType = 'table' | 'logs' | 'time_series';

const formatOptions: Array<ComboboxOption<PPLFormatType>> = [
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
    <EditorField
      htmlFor="format-combobox"
      label="Format"
      data-testid="ppl-format-wrapper"
      tooltip={<HelpMessage />}
      tooltipInteractive={true}
    >
      <Combobox
        id="format-combobox"
        options={formatOptions}
        onChange={(e) => dispatch(changeFormat(e.value))}
        value={format}
      />
    </EditorField>
  );
};
