import React, { useEffect, useState } from 'react';
import { DataSourceHttpSettings } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { OpenSearchOptions } from '../types';
import { OpenSearchDetails } from './OpenSearchDetails';
import { LogsConfig } from './LogsConfig';
import { DataLinks } from './DataLinks';
import { config, getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { coerceOptions, isValidOptions } from './utils';
import { SIGV4ConnectionConfig } from '@grafana/aws-sdk';
import { OpenSearchDatasource } from 'datasource';

export type Props = DataSourcePluginOptionsEditorProps<OpenSearchOptions>;
export const ConfigEditor = (props: Props) => {
  const { options: originalOptions, onOptionsChange } = props;
  const options = coerceOptions(originalOptions);

  // Apply some defaults on initial render
  useEffect(() => {
    if (!isValidOptions(originalOptions)) {
      onOptionsChange(coerceOptions(originalOptions));
    }

    // We can't enforce the eslint rule here because we only want to run this once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [saved, setSaved] = useState(!!options.version && options.version > 1);
  const datasource = useDatasource(props);

  useEffect(() => {
    setSaved(false);
  }, [
    options.url,
    options.access,
    options.basicAuth,
    options.basicAuthUser,
    options.withCredentials,
    options.secureJsonData,
    options.jsonData,
  ]);

  const saveOptions = async (value = options): Promise<void> => {
    if (saved) {
      return;
    }
    const { datasource } = await getBackendSrv().put(`/api/datasources/${options.id}`, value);
    value.version = datasource.version;
    onOptionsChange(value);
    setSaved(true);
  };

  return (
    <>
      <DataSourceHttpSettings
        defaultUrl={'http://localhost:9200'}
        dataSourceConfig={options}
        showAccessOptions={true}
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={config.sigV4AuthEnabled}
        renderSigV4Editor={<SIGV4ConnectionConfig {...props}></SIGV4ConnectionConfig>}
      />

      <OpenSearchDetails value={options} onChange={onOptionsChange} saveOptions={saveOptions} datasource={datasource} />

      <LogsConfig
        value={options.jsonData}
        onChange={newValue =>
          onOptionsChange({
            ...options,
            jsonData: newValue,
          })
        }
      />

      <DataLinks
        value={options.jsonData.dataLinks}
        onChange={newValue => {
          onOptionsChange({
            ...options,
            jsonData: {
              ...options.jsonData,
              dataLinks: newValue,
            },
          });
        }}
      />
    </>
  );
};

function useDatasource(props: Props) {
  const [datasource, setDatasource] = useState<OpenSearchDatasource>();

  useEffect(() => {
    if (props.options.version) {
      getDataSourceSrv()
        .get(props.options.uid)
        .then(datasource => {
          if (datasource instanceof OpenSearchDatasource) {
            setDatasource(datasource);
          }
        });
    }
  }, [props.options.version, props.options.uid]);

  return datasource;
}
