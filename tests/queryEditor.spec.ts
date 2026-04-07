import { test, expect } from '@grafana/plugin-e2e';

test('should render query editor', async ({ panelEditPage, selectors }) => {
  await panelEditPage.datasource.set('AWS OpenSearch');

  const legacyQueryEditorRow = panelEditPage.getQueryEditorRow('A');
  // TODO: Remove this fallback once @grafana/plugin-e2e picks up the Grafana 13 query-row selectors.
  const queryEditorRow =
    (await legacyQueryEditorRow.count()) > 0
      ? legacyQueryEditorRow
      : panelEditPage.getByGrafanaSelector('data-testid Query editor row').filter({
          has: panelEditPage.getByGrafanaSelector('data-testid Query editor row title A'),
        });

  await expect(queryEditorRow.getByTestId(selectors.components.QueryField.container)).toBeVisible();
});
