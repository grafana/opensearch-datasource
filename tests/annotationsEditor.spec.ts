import { expect, test } from '@grafana/plugin-e2e';

test('should render annotations editor', async ({ annotationEditPage, page, selectors }) => {
  await annotationEditPage.datasource.set('AWS OpenSearch');
  await expect(page.getByTestId(selectors.components.QueryField.container)).toBeVisible();
});
