import { test, expect } from '@grafana/plugin-e2e';

test('should render config editor', async ({ createDataSourceConfigPage, readProvisionedDataSource, page }) => {
  const ds = await readProvisionedDataSource({ fileName: 'aws-opensearch.yaml', name: 'AWS OpenSearch' });
  await createDataSourceConfigPage({ type: ds.type });
  await expect(page.getByText('OpenSearch details')).toBeVisible();
});
