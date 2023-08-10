import React, { useEffect, useState } from 'react';
import { DataSourceHttpSettings } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import { OpenSearchOptions } from '../types';
import { OpenSearchDetails } from './OpenSearchDetails';
import { LogsConfig } from './LogsConfig';
import { DataLinks } from './DataLinks';
import { config, getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { coerceOptions, isValidOptions } from './utils';
import { SIGV4ConnectionConfig } from '@grafana/aws-sdk';
import { OpenSearchDatasource } from 'datasource';
import { Auth, AuthMethod, convertLegacyAuthProps } from '@grafana/experimental';

type CustomMethodId = `custom-${string}`;
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

  const convertedAuthProps = {
    ...convertLegacyAuthProps({
      config: props.options,
      onChange: props.onOptionsChange,
    }),
  };
  const onSelectAuth = (auth: AuthMethod | CustomMethodId) => {
    convertedAuthProps.onAuthMethodSelect(auth);
    if (auth === 'custom-sigv4') {
      onOptionsChange({ ...props.options, jsonData: { ...props.options.jsonData, sigV4Auth: true } });
    } else {
      onOptionsChange({ ...props.options, jsonData: { ...props.options.jsonData, sigV4Auth: false } })
    }
  };

  return (
    <>
      {/* todo: sigv4 enabled in config? */}

      <Auth
        {...convertedAuthProps}
        selectedMethod={props.options.jsonData.sigV4Auth ? 'custom-sigv4' : AuthMethod.BasicAuth}
        visibleMethods={[AuthMethod.BasicAuth, AuthMethod.OAuthForward, 'custom-sigv4']}
        customMethods={[
          {
            id: 'custom-sigv4',
            label: 'SigV4',
            description: 'sigv4 deszcription',
            component: <SIGV4ConnectionConfig options={options} onOptionsChange={onOptionsChange} />,
          },
        ]}
        onAuthMethodSelect={onSelectAuth}
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
