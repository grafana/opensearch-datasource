import { test, expect } from '@grafana/plugin-e2e';

test('should render query editor', async ({ panelEditPage, selectors, grafanaVersion }) => {
  const queryEditorRow = grafanaVersion.startsWith('13.0.0')
    ? panelEditPage.getByGrafanaSelector('data-testid Query editor row').filter({
        has: panelEditPage.getByGrafanaSelector('data-testid Query editor row title A'),
      })
    : panelEditPage.getQueryEditorRow('A');

  await panelEditPage.datasource.set('AWS OpenSearch');
  await expect(queryEditorRow.getByTestId(selectors.components.QueryField.container)).toBeVisible();
});
