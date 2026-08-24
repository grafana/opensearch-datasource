import { test, expect } from '@grafana/plugin-e2e';
import type { OpenSearchOptions } from '../../src/types';
import { fieldFor, isCloudRun, LOGS_DATASOURCE_UID, PLUGIN_ID, PROVISIONING_FILE } from './helpers';

/**
 * The plugin refuses to run a health check until a version is known, so an ad-hoc datasource
 * has to be created with one already set — otherwise "Save & test" only ever renders
 * "No version set" and never calls /health.
 */
const configuredDataSource = (url: string) => ({
  type: PLUGIN_ID,
  url,
  jsonData: {
    flavor: 'opensearch',
    version: '2.18.0',
    versionLabel: 'OpenSearch 2.18.0',
    timeField: '@timestamp',
    tlsSkipVerify: true,
  },
});

test.describe('Config editor', () => {
  test.describe('rendering', () => {
    test('smoke: should render config editor', { tag: ['@plugins'] }, async ({ createDataSourceConfigPage, page }) => {
      await createDataSourceConfigPage({ type: PLUGIN_ID });
      await expect(page.getByRole('heading', { name: 'OpenSearch details' })).toBeVisible();
    });

    test('should render the HTTP connection section', async ({ createDataSourceConfigPage, page }) => {
      await createDataSourceConfigPage({ type: PLUGIN_ID });
      // Without `exact` this also matches the "Custom HTTP Headers" subheading.
      await expect(page.getByRole('heading', { name: 'HTTP', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Auth', exact: true })).toBeVisible();
      await expect(page.getByPlaceholder('http://localhost:9200')).toBeVisible();
    });

    test('should render the OpenSearch details section', async ({ createDataSourceConfigPage, page }) => {
      await createDataSourceConfigPage({ type: PLUGIN_ID });
      await expect(page.getByRole('heading', { name: 'OpenSearch details' })).toBeVisible();
      await expect(fieldFor(page, 'Index name')).toBeVisible();
      await expect(fieldFor(page, 'Time field name')).toBeVisible();
      // The "Min time interval" label points at an id the wrapped Input never renders,
      // so getByLabel does not resolve it.
      await expect(page.getByPlaceholder('10s')).toBeVisible();
      // The switch's input is visually hidden behind its styled label, so assert on state.
      await expect(page.getByLabel('PPL enabled')).toBeChecked();
    });

    test('should render the Logs and Data links sections', async ({ createDataSourceConfigPage, page }) => {
      await createDataSourceConfigPage({ type: PLUGIN_ID });
      await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible();
      await expect(fieldFor(page, 'Message field name')).toBeVisible();
      await expect(fieldFor(page, 'Level field name')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Data links' })).toBeVisible();
    });
  });

  test.describe('provisioned datasource', () => {
    test.beforeEach(() => {
      test.skip(
        isCloudRun,
        `These assert values from provisioning/datasources/${PROVISIONING_FILE}, which the shared Cloud instance never applies.`
      );
    });

    test('should load the provisioned connection details', async ({
      readProvisionedDataSource,
      gotoDataSourceConfigPage,
      page,
    }) => {
      const ds = await readProvisionedDataSource<OpenSearchOptions>({
        fileName: PROVISIONING_FILE,
        name: 'OpenSearch E2E Logs',
      });
      if (!ds.url) {
        throw new Error(`${PROVISIONING_FILE} has no url for OpenSearch E2E Logs`);
      }
      await gotoDataSourceConfigPage(ds.uid);
      await expect(page.getByPlaceholder('http://localhost:9200')).toHaveValue(ds.url);
      await expect(fieldFor(page, 'User')).toHaveValue('admin');
    });

    test('should load the provisioned OpenSearch details', async ({
      readProvisionedDataSource,
      gotoDataSourceConfigPage,
      page,
    }) => {
      const ds = await readProvisionedDataSource<OpenSearchOptions>({
        fileName: PROVISIONING_FILE,
        name: 'OpenSearch E2E Logs',
      });
      await gotoDataSourceConfigPage(ds.uid);
      await expect(fieldFor(page, 'Index name')).toHaveValue('e2e-logs');
      await expect(fieldFor(page, 'Time field name')).toHaveValue('@timestamp');
      // Only rendered once a version is known, so it is absent on an unconfigured datasource.
      await expect(page.getByLabel('Max concurrent Shard Requests input')).toHaveValue('5');
    });

    test('should load the provisioned logs field names', async ({
      readProvisionedDataSource,
      gotoDataSourceConfigPage,
      page,
    }) => {
      const ds = await readProvisionedDataSource<OpenSearchOptions>({
        fileName: PROVISIONING_FILE,
        name: 'OpenSearch E2E Logs',
      });
      await gotoDataSourceConfigPage(ds.uid);
      await expect(fieldFor(page, 'Message field name')).toHaveValue('message');
      await expect(fieldFor(page, 'Level field name')).toHaveValue('level');
    });
  });

  test.describe('save & test', () => {
    test('should pass the health check for the provisioned datasource', async ({ gotoDataSourceConfigPage, page }) => {
      test.skip(isCloudRun, 'The provisioned datasource does not exist on the shared Cloud instance.');
      await gotoDataSourceConfigPage(LOGS_DATASOURCE_UID);
      // A provisioned datasource is read-only, so Grafana renders "Test" in place of
      // "Save & test" and configPage.saveAndTest() would time out.
      await page.getByRole('button', { name: /^(Save & test|Test)$/ }).click();
      await expect(page.getByText('Index OK. Time field name OK.')).toBeVisible();
    });

    test('should show an error alert when the health check fails', async ({ createDataSourceConfigPage, page }) => {
      const configPage = await createDataSourceConfigPage(configuredDataSource('http://opensearch-node1:9200'));
      // First argument is the response body, second is the HTTP status.
      await configPage.mockHealthCheckResponse({ status: 'ERROR', message: 'mocked failure' }, 400);
      await page.getByRole('button', { name: 'Save & test' }).click();
      await expect(configPage).toHaveAlert('error');
    });

    test('should show an error alert when the backend is unreachable', async ({ createDataSourceConfigPage, page }) => {
      // Port 9199 is closed on the OpenSearch container, so the request fails on connection
      // refused rather than waiting out the proxy timeout.
      const configPage = await createDataSourceConfigPage(configuredDataSource('http://opensearch-node1:9199'));
      // configPage.saveAndTest() cannot be used here: the plugin fetches fields over its
      // resources endpoint first and aborts before Grafana ever calls /health, so waiting on
      // the health response times out.
      await page.getByRole('button', { name: 'Save & test' }).click();
      await expect(configPage).toHaveAlert('error', { hasText: 'Unable to fetch fields from the datasource' });
    });
  });
});
