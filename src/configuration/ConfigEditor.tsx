import React, { useEffect, useState } from 'react';
import { DataSourcePluginOptionsEditorProps, SelectableValue } from '@grafana/data';
import { OpenSearchOptions } from '../types';
import { OpenSearchDetails } from './OpenSearchDetails';
import { LogsConfig } from './LogsConfig';
import { DataLinks } from './DataLinks';
import { config, getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { coerceOptions, isValidOptions } from './utils';
import { SIGV4ConnectionConfig } from '@grafana/aws-sdk';
import { OpenSearchDatasource } from 'datasource';
import { AdvancedHttpSettings, Auth, AuthMethod, ConfigSection, convertLegacyAuthProps } from '@grafana/experimental';
import { InlineField, Input, Select } from '@grafana/ui';
import { css } from '@emotion/css';
import { useEffectOnce } from 'react-use';

const Sigv4MethodId: CustomMethodId = 'custom-sigv4'
type CustomMethodId = `custom-${string}`;

const ACCESS_OPTIONS: Array<SelectableValue<string>> = [
  {
    label: 'Server (default)',
    value: 'proxy',
  },
  {
    label: 'Browser',
    value: 'direct',
  },
];

export type Props = DataSourcePluginOptionsEditorProps<OpenSearchOptions>;
export const ConfigEditor = (props: Props) => {
  const { options: originalOptions, onOptionsChange } = props;
  const [visibleMethods, setVisibleMethods] = useState([AuthMethod.BasicAuth, AuthMethod.OAuthForward, ...(config.sigV4AuthEnabled? [Sigv4MethodId]: [])])
  const options = coerceOptions(originalOptions);
  const convertedAuthProps = {
    ...convertLegacyAuthProps({
      config: props.options,
      onChange: props.onOptionsChange,
    }),
  };
  // Apply some defaults on initial render
  useEffectOnce(() => {
    if (!isValidOptions(originalOptions)) {
      onOptionsChange(coerceOptions(originalOptions));
    }
  });

  useEffect(function setAllowedAuthMethods() {
    // if direct access, only basic auth and credentials
    if (props.options.access === 'direct') {
    setVisibleMethods([AuthMethod.BasicAuth, AuthMethod.CrossSiteCredentials])
      if(!props.options.basicAuth) {
        convertedAuthProps.onAuthMethodSelect(AuthMethod.BasicAuth);
      }
    } else {
      setVisibleMethods([AuthMethod.BasicAuth, AuthMethod.OAuthForward, AuthMethod.CrossSiteCredentials, ...(config.sigV4AuthEnabled? [Sigv4MethodId]: [])])
    }
  }, [props.options.access])

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

  
  const onSelectAuth = (auth: AuthMethod | CustomMethodId) => {
    // convertedAuthProps.onAuthMethodSelect(auth);
    // hanve to overwrite props.onAuthMethodSelect cause it looks like there's a race condition when 
    // calling both that and onChange below
    if (auth === 'custom-sigv4') {
      onOptionsChange({ ...props.options, basicAuth: false, withCredentials: false, jsonData: { ...props.options.jsonData, sigV4Auth: true } });
    } else if (auth === AuthMethod.BasicAuth) {
      onOptionsChange({ ...props.options, basicAuth: true, withCredentials: false, jsonData: { ...props.options.jsonData, sigV4Auth: false } })

    } else if(auth === AuthMethod.CrossSiteCredentials){
      onOptionsChange({ ...props.options, basicAuth: false, withCredentials: true, jsonData: { ...props.options.jsonData, sigV4Auth: false } })
    } 
    else{
      onOptionsChange({ ...props.options, basicAuth: false, withCredentials: false, jsonData: { ...props.options.jsonData, sigV4Auth: false } })

    }
  };

  return (
    <>
      {/* css */}
    <ConfigSection
      title="HTTP"
      className={css`{marginBottom: 24px}`}
    >
      <InlineField
        label="URL"
        labelWidth={16}
        required
        htmlFor="url-input"
        interactive
        grow
      >
        <Input
          id="url-input"
          placeholder="http://localhost:9200"
          value={props.options.url}
          onChange={(e) => onOptionsChange({...props.options, url: e.currentTarget.value})}
          required
          width={40}
        />
      </InlineField>
      <InlineField label="Access" labelWidth={16} style={{ marginBottom: 16 }}>
        <Select 
          aria-label="Access"
          className="width-20 gf-form-input"
          options={ACCESS_OPTIONS}
          value={ACCESS_OPTIONS.filter((o) => o.value === props.options.access)[0] || ACCESS_OPTIONS[0]}
          onChange={(selectedValue) => onOptionsChange({...props.options, access: selectedValue.value})}
          disabled={ props.options.readOnly}
        /> 
      </InlineField>
      <AdvancedHttpSettings
      className={css({marginBottom: 16})}
        config={ props.options}
        onChange={props.onOptionsChange}
      />
      </ConfigSection>

      <Auth

        { ...convertedAuthProps}
        selectedMethod={props.options.jsonData.sigV4Auth ? 'custom-sigv4' : convertedAuthProps.selectedMethod}
        visibleMethods={visibleMethods}
        customMethods={[
          {
            id: 'custom-sigv4',
            label: 'SigV4',
            description: 'sigv4 deszcription',
            component: <SIGV4ConnectionConfig options={options} onOptionsChange={onOptionsChange} />,
          },
        ]}
        onAuthMethodSelect={onSelectAuth}
        customHeaders={convertedAuthProps.customHeaders}
      />

      <OpenSearchDetails  value={options} onChange={onOptionsChange} saveOptions={saveOptions} datasource={datasource} />

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
