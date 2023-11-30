import { DataSourcePlugin } from '@grafana/data';
import { OpenSearchDatasource } from './datasource';
import { ConfigEditor } from './configuration/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { OpenSearchQuery } from 'types';
import { AwsAuthDataSourceJsonData } from '@grafana/aws-sdk';
new DataSourcePlugin<XrayDataSource, XrayQuery, XrayJsonData, AwsAuthDataSourceSecureJsonData>(
  XrayDataSource
)
export const plugin = new DataSourcePlugin<OpenSearchDatasource, OpenSearchQuery, {}, AwsAuthDataSourceJsonData>(OpenSearchDatasource)
  .setQueryEditor(QueryEditor)
  .setConfigEditor(ConfigEditor);
