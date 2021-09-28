import React from 'react';
import { EventsWithValidation, regexValidation, LegacyForms } from '@grafana/ui';
const { Select, Input, FormField, Switch } = LegacyForms;
import { Flavor, OpenSearchOptions } from '../types';
import { DataSourceSettings, SelectableValue } from '@grafana/data';
import { AVAILABLE_FLAVORS, AVAILABLE_VERSIONS } from './utils';

const indexPatternTypes = [
  { label: 'No pattern', value: 'none' },
  { label: 'Hourly', value: 'Hourly', example: '[logstash-]YYYY.MM.DD.HH' },
  { label: 'Daily', value: 'Daily', example: '[logstash-]YYYY.MM.DD' },
  { label: 'Weekly', value: 'Weekly', example: '[logstash-]GGGG.WW' },
  { label: 'Monthly', value: 'Monthly', example: '[logstash-]YYYY.MM' },
  { label: 'Yearly', value: 'Yearly', example: '[logstash-]YYYY' },
];

type Props = {
  value: DataSourceSettings<OpenSearchOptions>;
  onChange: (value: DataSourceSettings<OpenSearchOptions>) => void;
};
export const OpenSearchDetails = (props: Props) => {
  const { value, onChange } = props;

  return (
    <>
      <h3 className="page-heading">OpenSearch details</h3>

      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <FormField
              labelWidth={10}
              inputWidth={15}
              label="Index name"
              value={value.jsonData.database || ''}
              onChange={jsonDataChangeHandler('database', value, onChange)}
              placeholder={'es-index-name'}
              required
            />
          </div>

          <div className="gf-form">
            <FormField
              labelWidth={10}
              label="Pattern"
              inputEl={
                <Select
                  options={indexPatternTypes}
                  onChange={intervalHandler(value, onChange)}
                  value={indexPatternTypes.find(
                    pattern =>
                      pattern.value === (value.jsonData.interval === undefined ? 'none' : value.jsonData.interval)
                  )}
                />
              }
            />
          </div>
        </div>

        <div className="gf-form max-width-25">
          <FormField
            labelWidth={10}
            inputWidth={15}
            label="Time field name"
            value={value.jsonData.timeField || ''}
            onChange={jsonDataChangeHandler('timeField', value, onChange)}
            required
          />
        </div>

        <div className="gf-form">
          <FormField
            labelWidth={10}
            inputWidth={15}
            label="Flavor"
            inputEl={
              <Select
                options={AVAILABLE_FLAVORS}
                onChange={option => {
                  onChange({
                    ...value,
                    jsonData: {
                      ...value.jsonData,
                      flavor: option.value as Flavor,
                      version: AVAILABLE_VERSIONS[option.value][AVAILABLE_VERSIONS[option.value].length - 1].value,
                    },
                  });
                }}
                value={AVAILABLE_FLAVORS.find(flavor => flavor.value === value.jsonData.flavor)}
              />
            }
          />
        </div>

        <div className="gf-form">
          <FormField
            labelWidth={10}
            inputWidth={15}
            label="Version"
            inputEl={
              <Select
                options={AVAILABLE_VERSIONS[value.jsonData.flavor]}
                onChange={option => {
                  onChange({
                    ...value,
                    jsonData: {
                      ...value.jsonData,
                      version: option.value!,
                    },
                  });
                }}
                value={AVAILABLE_VERSIONS[value.jsonData.flavor].find(
                  version => version.value === value.jsonData.version
                )}
              />
            }
          />
        </div>
        <div className="gf-form max-width-30">
          <FormField
            aria-label={'Max concurrent Shard Requests input'}
            labelWidth={15}
            label="Max concurrent Shard Requests"
            value={value.jsonData.maxConcurrentShardRequests || ''}
            onChange={jsonDataChangeHandler('maxConcurrentShardRequests', value, onChange)}
          />
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <FormField
              labelWidth={10}
              label="Min time interval"
              inputEl={
                <Input
                  className={'width-6'}
                  value={value.jsonData.timeInterval || ''}
                  onChange={jsonDataChangeHandler('timeInterval', value, onChange)}
                  placeholder="10s"
                  validationEvents={{
                    [EventsWithValidation.onBlur]: [
                      regexValidation(
                        /^\d+(ms|[Mwdhmsy])$/,
                        'Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s'
                      ),
                    ],
                  }}
                />
              }
              tooltip={
                <>
                  A lower limit for the auto group by time interval. Recommended to be set to write frequency, for
                  example <code>1m</code> if your data is written every minute.
                </>
              }
            />
          </div>
        </div>
        <div className="gf-form">
          <Switch
            label="PPL enabled"
            labelClass="width-10"
            tooltip="Allow Piped Processing Language as an alternative query syntax in the OpenSearch query editor."
            checked={value.jsonData.pplEnabled ?? true}
            onChange={jsonDataSwitchChangeHandler('pplEnabled', value, onChange)}
          />
        </div>
      </div>
    </>
  );
};

const jsonDataChangeHandler = (key: keyof OpenSearchOptions, value: Props['value'], onChange: Props['onChange']) => (
  event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>
) => {
  onChange({
    ...value,
    jsonData: {
      ...value.jsonData,
      [key]: event.currentTarget.value,
    },
  });
};

const jsonDataSwitchChangeHandler = (
  key: keyof OpenSearchOptions,
  value: Props['value'],
  onChange: Props['onChange']
) => (event: React.SyntheticEvent<HTMLInputElement>) => {
  onChange({
    ...value,
    jsonData: {
      ...value.jsonData,
      [key]: event.currentTarget.checked,
    },
  });
};

const intervalHandler = (value: Props['value'], onChange: Props['onChange']) => (option: SelectableValue<string>) => {
  const { database } = value;
  // If option value is undefined it will send its label instead so we have to convert made up value to undefined here.
  const newInterval = option.value === 'none' ? undefined : option.value;

  if (!database || database.length === 0 || database.startsWith('[logstash-]')) {
    let newDatabase = '';

    if (newInterval !== undefined) {
      const pattern = indexPatternTypes.find(pattern => pattern.value === newInterval);

      if (pattern) {
        newDatabase = pattern.example ?? '';
      }
    }

    onChange({
      ...value,
      database: newDatabase,
      jsonData: {
        ...value.jsonData,
        interval: newInterval,
      },
    });
  } else {
    onChange({
      ...value,
      jsonData: {
        ...value.jsonData,
        interval: newInterval,
      },
    });
  }
};
