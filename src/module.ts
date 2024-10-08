import { DataSourcePlugin } from '@grafana/data';
import { OpenSearchDatasource } from './opensearchDatasource';
import { ConfigEditor } from './configuration/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';

export const plugin = new DataSourcePlugin(OpenSearchDatasource)
  .setQueryEditor(QueryEditor)
  .setConfigEditor(ConfigEditor);
