import { test, expect, type ExplorePage } from '@grafana/plugin-e2e';
import type { Locator, Page } from '@playwright/test';
import {
  CLOUD_DATASOURCE_UID,
  CLOUD_INDEX,
  exploreUrl,
  fieldFor,
  fieldNames,
  FIXTURE_LOG_COUNT,
  FIXTURE_TRACE_COUNT,
  isCloudRun,
  LOGS_DATASOURCE_UID,
  LOGS_INDEX,
  luceneQuery,
  rowCount,
  selectOption,
  TRACES_DATASOURCE_UID,
  waitForQueryDataResponseWithBody,
} from './helpers';

/** Rendering assertions do not depend on fixture data, so they run in either lane. */
const RENDERING_UID = isCloudRun ? CLOUD_DATASOURCE_UID : LOGS_DATASOURCE_UID;

/**
 * PPL cannot be selected through the Explore URL: the editor dispatches `initQuery` on
 * mount and `queryTypeReducer` unconditionally resets `queryType` to Lucene, so an encoded
 * `queryType: 'PPL'` is discarded and the PPL text is parsed as Lucene instead. Switching
 * also clears the query string, so the query has to be rebuilt afterwards.
 */
async function switchToPPL(page: Page, { format }: { format: 'Table' | 'Logs' | 'Time series' }) {
  await page.getByTestId('query-type-select').click();
  await selectOption(page, 'PPL').click();
  // The PPL editor renders asynchronously; its header button is the signal it has mounted.
  await expect(page.getByTestId('sample-query-button')).toBeVisible();
  // The editor only *displays* the default format — it never writes it into the query, so
  // the backend falls back to time_series and rejects a table-shaped response. Selecting it
  // explicitly is what puts `format` on the query.
  await page.getByTestId('format-select').click();
  await selectOption(page, format).click();
}

/**
 * Everything the plugin renders lives inside the query editor row. Scoping to it matters:
 * once a query returns, Explore renders a result panel whose visualisation picker has radios
 * with the same labels as the Lucene query type picker ("Logs", "Table"), so an unscoped
 * `getByRole('radio', { name: 'Logs' })` intermittently matches two elements and fails on a
 * strict-mode violation depending on whether the response has landed yet.
 *
 * The row is addressed differently across the Grafana versions the CI matrix covers:
 * plugin-e2e's selectors resolve on 12.x and below, while Grafana 13 renders
 * `data-testid Query editor row`. Try the former and fall back to the latter.
 */
async function queryRow(page: Page, explorePage: ExplorePage): Promise<Locator> {
  const row = explorePage.getQueryEditorRow('A');
  return (await row.count()) > 0 ? row : page.locator('[data-testid="data-testid Query editor row"]');
}

/**
 * Explore renders the query row before the plugin's editor has mounted, so asserting on the
 * editor's controls straight after `goto` races the mount. Anchor on the query type picker —
 * the first thing the editor renders — before touching anything inside it.
 */
async function gotoQueryEditor(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId('query-type-select')).toBeVisible();
}

/** Picking an index in PPL mode rewrites the query to `source = <index> | HEAD 10`. */
async function selectIndex(page: Page, index: string) {
  await page.getByTestId('index-picker-button').click();
  await expect(page.getByTestId(`index-row-${index}`)).toBeVisible();
  await page.getByTestId(`index-row-${index}`).click();
  await page.getByTestId('modal-select').click();
}

test.describe('Query editor', () => {
  test.describe('rendering', () => {
    test('smoke: should render the query editor', { tag: ['@plugins'] }, async ({ page, selectors }) => {
      await gotoQueryEditor(page, exploreUrl(RENDERING_UID, luceneQuery.metric()));
      await expect(page.getByTestId('index-picker-button')).toBeVisible();
      await expect(page.getByTestId(selectors.components.QueryField.container)).toBeVisible();
    });

    test('should offer both query languages', async ({ page }) => {
      await gotoQueryEditor(page, exploreUrl(RENDERING_UID, luceneQuery.metric()));
      await page.getByTestId('query-type-select').click();
      await expect(selectOption(page, 'Lucene')).toBeVisible();
      await expect(selectOption(page, 'PPL')).toBeVisible();
    });

    test('should offer every Lucene query type', async ({ page, explorePage }) => {
      await gotoQueryEditor(page, exploreUrl(RENDERING_UID, luceneQuery.metric()));
      const row = await queryRow(page, explorePage);
      for (const name of ['Metric', 'Logs', 'Raw Data', 'Raw Document', 'Traces']) {
        await expect(row.getByRole('radio', { name, exact: true })).toBeVisible();
      }
    });

    test('should show metric and bucket aggregation rows in Metric mode', async ({ page, explorePage }) => {
      await gotoQueryEditor(page, exploreUrl(RENDERING_UID, luceneQuery.metric()));
      const row = await queryRow(page, explorePage);
      await expect(row.getByRole('radio', { name: 'Metric', exact: true })).toBeChecked();
      await expect(row.getByText('Group By')).toBeVisible();
      await expect(row.getByText('Date Histogram')).toBeVisible();
    });

    test('should drop the bucket aggregation row in Logs mode', async ({ page, explorePage }) => {
      await gotoQueryEditor(page, exploreUrl(RENDERING_UID, luceneQuery.logs()));
      const row = await queryRow(page, explorePage);
      await expect(row.getByRole('radio', { name: 'Logs', exact: true })).toBeChecked();
      await expect(row.getByText('Group By')).toBeHidden();
    });

    test('should show Service Map and Size controls in Traces mode', async ({ page, explorePage }) => {
      await gotoQueryEditor(page, exploreUrl(RENDERING_UID, luceneQuery.traces()));
      const row = await queryRow(page, explorePage);
      await expect(row.getByRole('radio', { name: 'Traces', exact: true })).toBeChecked();
      // The switch's input is visually hidden behind its styled label.
      await expect(fieldFor(page, 'Service Map')).toBeAttached();
      await expect(page.getByTestId('span-limit-input')).toBeVisible();
    });

    test('should switch Lucene query type from the radio group', async ({ page, explorePage }) => {
      await gotoQueryEditor(page, exploreUrl(RENDERING_UID, luceneQuery.metric()));
      const row = await queryRow(page, explorePage);
      await row.getByRole('radio', { name: 'Raw Data', exact: true }).click();
      // The builder rows re-render asynchronously after the click; waiting for the radio to
      // settle avoids asserting against the pre-switch layout.
      await expect(row.getByRole('radio', { name: 'Raw Data', exact: true })).toBeChecked();
      await expect(row.getByText('Group By')).toBeHidden();
    });

    test('should render the PPL editor in place of the Lucene one', async ({ page, explorePage }) => {
      await gotoQueryEditor(page, exploreUrl(RENDERING_UID, luceneQuery.metric()));
      const row = await queryRow(page, explorePage);
      await switchToPPL(page, { format: 'Table' });
      await expect(page.getByTestId('sample-query-button')).toBeVisible();
      await expect(row.getByRole('radio', { name: 'Metric', exact: true })).toBeHidden();
    });

    test('should list the available indices in the index picker', async ({ page }) => {
      await gotoQueryEditor(page, exploreUrl(RENDERING_UID, luceneQuery.metric()));
      await page.getByTestId('index-picker-button').click();
      await expect(page.getByTestId('index-picker-search')).toBeVisible();
      await expect(page.getByTestId(`index-row-${isCloudRun ? CLOUD_INDEX : LOGS_INDEX}`)).toBeVisible();
    });
  });

  test.describe('with fixture data', () => {
    // These share one OpenSearch cluster; running them in parallel produces slow responses
    // that are indistinguishable from failures.
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(() => {
      test.skip(isCloudRun, 'The fixture indices only exist in the local docker-compose cluster.');
    });

    test('Metric: should return a time series over the fixture window', async ({ page, explorePage }) => {
      const { responsePromise, getBody } = waitForQueryDataResponseWithBody(explorePage);
      await page.goto(exploreUrl(LOGS_DATASOURCE_UID, luceneQuery.metric()));
      await responsePromise;
      expect(fieldNames(getBody())).toContain('Time');
      expect(rowCount(getBody())).toBeGreaterThan(0);
    });

    test('Raw Data: should narrow the result set with a Lucene filter', async ({ page, explorePage }) => {
      const unfiltered = waitForQueryDataResponseWithBody(explorePage);
      await page.goto(exploreUrl(LOGS_DATASOURCE_UID, luceneQuery.rawData()));
      await unfiltered.responsePromise;
      expect(rowCount(unfiltered.getBody())).toBe(FIXTURE_LOG_COUNT);

      const filtered = waitForQueryDataResponseWithBody(explorePage);
      await page.goto(exploreUrl(LOGS_DATASOURCE_UID, luceneQuery.rawData('level:error')));
      await filtered.responsePromise;
      const errors = rowCount(filtered.getBody());
      expect(errors).toBeGreaterThan(0);
      expect(errors).toBeLessThan(FIXTURE_LOG_COUNT);
    });

    test('Logs: should return every fixture document', async ({ page, explorePage }) => {
      const { responsePromise, getBody } = waitForQueryDataResponseWithBody(explorePage);
      await page.goto(exploreUrl(LOGS_DATASOURCE_UID, luceneQuery.logs()));
      await responsePromise;
      expect(rowCount(getBody())).toBe(FIXTURE_LOG_COUNT);
    });

    test('Raw Document: should return every fixture document', async ({ page, explorePage }) => {
      const { responsePromise, getBody } = waitForQueryDataResponseWithBody(explorePage);
      await page.goto(exploreUrl(LOGS_DATASOURCE_UID, luceneQuery.rawDocument()));
      await responsePromise;
      expect(rowCount(getBody())).toBe(FIXTURE_LOG_COUNT);
    });

    test('PPL: should query the fixture index selected in the index picker', async ({ page, explorePage }) => {
      await page.goto(exploreUrl(LOGS_DATASOURCE_UID, luceneQuery.metric()));
      await switchToPPL(page, { format: 'Table' });
      await selectIndex(page, LOGS_INDEX);

      const { responsePromise, getBody } = waitForQueryDataResponseWithBody(explorePage);
      await page.getByTestId('data-testid RefreshPicker run button').click();
      await responsePromise;
      // The picker rewrites the query to `source = e2e-logs | HEAD 10`.
      expect(rowCount(getBody())).toBe(10);
      expect(fieldNames(getBody())).toEqual(expect.arrayContaining(['level', 'message', 'service']));
    });

    test('Traces: should list the fixture traces', async ({ page, explorePage }) => {
      const { responsePromise, getBody } = waitForQueryDataResponseWithBody(explorePage);
      await page.goto(exploreUrl(TRACES_DATASOURCE_UID, luceneQuery.traces()));
      await responsePromise;
      expect(rowCount(getBody())).toBe(FIXTURE_TRACE_COUNT);
    });

    test('Traces: should return the spans of a single trace', async ({ page, explorePage }) => {
      const list = waitForQueryDataResponseWithBody(explorePage);
      await page.goto(exploreUrl(TRACES_DATASOURCE_UID, luceneQuery.traces()));
      await list.responsePromise;
      const frames = (list.getBody()?.results?.A?.frames ?? []) as Array<{ data?: { values?: string[][] } }>;
      const traceId = frames[0]?.data?.values?.[0]?.[0];
      expect(traceId).toBeTruthy();

      const spans = waitForQueryDataResponseWithBody(explorePage);
      await page.goto(exploreUrl(TRACES_DATASOURCE_UID, luceneQuery.traces(`traceId:${traceId}`)));
      await spans.responsePromise;
      // One root span plus three children per fixture trace.
      expect(rowCount(spans.getBody())).toBe(4);
    });
  });

  test.describe('against the Cloud instance', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(() => {
      test.skip(!isCloudRun, 'Only meaningful against the shared Cloud instance and its data generator.');
    });

    // Cloud data is generated continuously and its retention window moves with the clock, so
    // a pinned fixture window would go stale and row counts are not deterministic. Assert
    // that the query succeeded and returned rows, not exact values.
    const recent = { from: 'now-3h', to: 'now' };

    test('Logs: should return documents from the managed instance', async ({ page, explorePage }) => {
      const { responsePromise, getBody } = waitForQueryDataResponseWithBody(explorePage);
      await page.goto(exploreUrl(CLOUD_DATASOURCE_UID, { ...luceneQuery.logs(), index: CLOUD_INDEX }, recent));
      await responsePromise;
      expect(getBody()?.results?.A?.error).toBeUndefined();
      expect(rowCount(getBody())).toBeGreaterThan(0);
    });

    test('Metric: should return a time series from the managed instance', async ({ page, explorePage }) => {
      const { responsePromise, getBody } = waitForQueryDataResponseWithBody(explorePage);
      await page.goto(exploreUrl(CLOUD_DATASOURCE_UID, { ...luceneQuery.metric(), index: CLOUD_INDEX }, recent));
      await responsePromise;
      expect(getBody()?.results?.A?.error).toBeUndefined();
      expect(rowCount(getBody())).toBeGreaterThan(0);
    });

    test('PPL: should query the managed instance', async ({ page, explorePage }) => {
      await page.goto(exploreUrl(CLOUD_DATASOURCE_UID, luceneQuery.metric(), recent));
      await switchToPPL(page, { format: 'Table' });
      await selectIndex(page, CLOUD_INDEX);

      const { responsePromise, getBody } = waitForQueryDataResponseWithBody(explorePage);
      await page.getByTestId('data-testid RefreshPicker run button').click();
      await responsePromise;
      expect(getBody()?.results?.A?.error).toBeUndefined();
      expect(rowCount(getBody())).toBeGreaterThan(0);
    });
  });
});
