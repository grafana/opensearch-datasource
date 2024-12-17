import { expect, test } from '@grafana/plugin-e2e';

test('should render annotations editor', async ({ annotationEditPage, page }) => {
  await annotationEditPage.datasource.set('AWS OpenSearch');
  await expect(page.getByTestId('data-testid Query field')).toBeVisible();
});
