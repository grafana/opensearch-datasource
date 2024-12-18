import { test, expect } from '@grafana/plugin-e2e';

test('should render query editor', async ({ panelEditPage, selectors }) => {
  await panelEditPage.datasource.set('AWS OpenSearch');
  await expect(
    panelEditPage.getQueryEditorRow('A').getByTestId(selectors.components.QueryField.container)
  ).toBeVisible();
});
