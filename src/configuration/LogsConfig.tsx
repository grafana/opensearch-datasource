import React from 'react';
import { LegacyForms } from '@grafana/ui';
const { FormField } = LegacyForms;
import { OpenSearchOptions } from '../types';

type Props = {
  value: OpenSearchOptions;
  onChange: (value: OpenSearchOptions) => void;
};
export const LogsConfig = (props: Props) => {
  const { value, onChange } = props;
  const changeHandler = (key: keyof OpenSearchOptions) => (
    event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    onChange({
      ...value,
      [key]: event.currentTarget.value,
    });
  };

  return (
    <>
      <h3 className="page-heading">Logs</h3>

      <div className="gf-form-group">
        <div className="gf-form max-width-30">
          <FormField
            labelWidth={11}
            label="Message field name"
            value={value.logMessageField}
            onChange={changeHandler('logMessageField')}
            placeholder="_source"
          />
        </div>
        <div className="gf-form max-width-30">
          <FormField
            labelWidth={11}
            label="Level field name"
            value={value.logLevelField}
            onChange={changeHandler('logLevelField')}
          />
        </div>
      </div>
    </>
  );
};
