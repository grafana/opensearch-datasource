import { DataSourceInstanceSettings, DataSourcePluginMeta, PluginMetaInfo, PluginType } from '@grafana/data';
import { OpenSearchDatasource } from 'opensearchDatasource';
import { Flavor, OpenSearchOptions } from 'types';

const info: PluginMetaInfo = {
  author: {
    name: '',
  },
  description: '',
  links: [],
  logos: {
    large: '',
    small: '',
  },
  screenshots: [],
  updated: '',
  version: '',
};

export const meta: DataSourcePluginMeta<OpenSearchOptions> = {
  id: '',
  name: '',
  type: PluginType.datasource,
  info,
  module: '',
  baseUrl: '',
};

export const OpenSearchSettings: DataSourceInstanceSettings<OpenSearchOptions> = {
  jsonData: {
    defaultRegion: 'us-west-1',
    database: '',
    timeField: '',
    version: '2.13.0',
    flavor: Flavor.OpenSearch,
    timeInterval: '',
  },
  id: 0,
  uid: '',
  type: '',
  name: 'OpenSearch Test Datasource',
  meta,
  access: 'direct',
  readOnly: false,
};
export function setupMockedDataSource(
  customInstanceSettings: DataSourceInstanceSettings<OpenSearchOptions> = OpenSearchSettings
) {
  const datasource = new OpenSearchDatasource(customInstanceSettings);
  return datasource;
}
