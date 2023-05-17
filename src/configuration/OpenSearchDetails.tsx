import React, { useState } from 'react';
import { EventsWithValidation, regexValidation, LegacyForms, Button, Alert, VerticalGroup } from '@grafana/ui';
const { Select, Input, FormField, Switch } = LegacyForms;
import { Flavor, OpenSearchOptions } from '../types';
import { DataSourceSettings, SelectableValue } from '@grafana/data';
import { AVAILABLE_FLAVORS } from './utils';
import { gte, lt } from 'semver';
import { OpenSearchDatasource } from 'datasource';

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
  saveOptions: (value?: DataSourceSettings<OpenSearchOptions>) => Promise<void>;
  datasource: OpenSearchDatasource;
};
export const OpenSearchDetails = (props: Props) => {
  const { value, onChange, saveOptions, datasource } = props;
  const [versionErr, setVersionErr] = useState<string>('');

  const setVersion = async () => {
    setVersionErr('');
    await saveOptions();
    try {
      const version = await datasource.getOpenSearchVersion();
      await saveOptions({
        ...value,
        jsonData: {
          ...value.jsonData,
          version: version.version,
          flavor: version.flavor,
          maxConcurrentShardRequests: getMaxConcurrentShardRequestOrDefault(
            version.flavor,
            version.version,
            value.jsonData.maxConcurrentShardRequests
          ),
        },
      });
    } catch (error) {
      let message = String(error);
      if (error instanceof Error) {
        message = error.message;
      }
      setVersionErr(message);
    }
  };

  let versionString = '';
  if (value.jsonData.flavor && value.jsonData.version) {
    versionString = `${AVAILABLE_FLAVORS.find(f => f.value === value.jsonData.flavor)?.label ||
      value.jsonData.flavor} ${value.jsonData.version}`;
  }

  const getServerlessSettings = (event: React.SyntheticEvent<HTMLInputElement, Event>) => {
    // Adds the latest version if it isn't set (query construction requires a version)
    return {
      ...value,
      jsonData: {
        ...value.jsonData,
        serverless: event.currentTarget.checked,
        flavor: Flavor.OpenSearch,
        version: '1.0.0',
        maxConcurrentShardRequests: 5,
        pplEnabled: !event.currentTarget.checked,
      },
    };
  };

  return (
    <>
      <h3 className="page-heading">OpenSearch details</h3>

      {!value.jsonData.serverless && (
        <Alert
          title="When the connected OpenSearch instance is upgraded, the configured version should be updated."
          severity="info"
        >
          <VerticalGroup>
            <div>
              The plugin uses the configured version below to construct the queries it sends to the connected OpenSearch
              instance. If the configured version does not match the instance version, there could be query errors.
            </div>
          </VerticalGroup>
        </Alert>
      )}

      {versionErr && <Alert title={versionErr} severity="error" />}

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
        <div className="gf-form-inline">
          <Switch
            label="Serverless"
            labelClass="width-10"
            tooltip="If this is a DataSource to query a serverless OpenSearch service."
            checked={value.jsonData.serverless ?? false}
            onChange={event => {
              onChange(getServerlessSettings(event));
            }}
          />
        </div>
        {!value.jsonData.serverless && (
          <div className="gf-form">
            <FormField
              labelWidth={10}
              inputWidth={15}
              label="Version"
              value={versionString}
              placeholder={'version required'}
              disabled
              required
            />
            <Button onClick={setVersion} variant="secondary">
              Get Version and Save
            </Button>
          </div>
        )}
        {shouldRenderMaxConcurrentShardRequests(value.jsonData) && (
          <div className="gf-form max-width-30">
            <FormField
              aria-label="Max concurrent Shard Requests input"
              labelWidth={15}
              label="Max concurrent Shard Requests"
              value={value.jsonData.maxConcurrentShardRequests || ''}
              onChange={jsonDataChangeHandler('maxConcurrentShardRequests', value, onChange)}
            />
          </div>
        )}
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
        {!value.jsonData.serverless && (
          <div className="gf-form">
            <Switch
              label="PPL enabled"
              labelClass="width-10"
              tooltip="Allow Piped Processing Language as an alternative query syntax in the OpenSearch query editor."
              checked={value.jsonData.pplEnabled ?? true}
              onChange={jsonDataSwitchChangeHandler('pplEnabled', value, onChange)}
            />
          </div>
        )}
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

function shouldRenderMaxConcurrentShardRequests(settings: OpenSearchOptions) {
  const { flavor, version, serverless } = settings;
  if (serverless) {
    return false;
  }

  if (!flavor || !version) {
    return false;
  }

  if (flavor === Flavor.OpenSearch) {
    return true;
  }

  return gte(version, '5.6.0');
}

function getMaxConcurrentShardRequestOrDefault(
  flavor: Flavor,
  version: string,
  maxConcurrentShardRequests?: number
): number {
  if (maxConcurrentShardRequests === 5 && lt(version, '7.0.0') && flavor === Flavor.Elasticsearch) {
    return 256;
  }

  if (
    maxConcurrentShardRequests === 256 &&
    ((gte(version, '7.0.0') && flavor === Flavor.Elasticsearch) || flavor === Flavor.OpenSearch)
  ) {
    return 5;
  }

  return maxConcurrentShardRequests || defaultMaxConcurrentShardRequests(flavor, version);
}

export function defaultMaxConcurrentShardRequests(flavor: Flavor, version: string) {
  if (!flavor || !version) {
    return 0;
  }
  return lt(version, '7.0.0') && flavor === Flavor.Elasticsearch ? 256 : 5;
}
