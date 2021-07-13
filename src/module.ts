import { DataSourcePlugin } from '@grafana/data';
import { OpenSearchDatasource } from './datasource';
import { ConfigEditor } from './configuration/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
// Fix for https://github.com/grafana/grafana/issues/26512
import {} from '@emotion/core';

class ElasticAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(OpenSearchDatasource)
  .setQueryEditor(QueryEditor)
  .setConfigEditor(ConfigEditor)
  .setAnnotationQueryCtrl(ElasticAnnotationsQueryCtrl);
