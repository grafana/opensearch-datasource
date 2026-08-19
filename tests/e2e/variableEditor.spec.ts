import { expect, test } from '@grafana/plugin-e2e';
import { DATASOURCE_NAME } from './helpers';

/**
 * The plugin registers no variable query editor, so Grafana renders its default text input
 * and hands the raw string to `metricFindQuery`, which expects JSON.
 *
 * Only `find: fields` is asserted on here. A `find: terms` lookup is bounded by the
 * dashboard time range, and the variable editor opens a new dashboard fixed at `now-6h` with
 * no way to override it before the preview runs — so it can never reach the fixture window,
 * which is pinned in the past by design.
 */
test.describe('Variable editor', () => {
  test('should resolve a fields query', async ({ variableEditPage, page }) => {
    await variableEditPage.datasource.set(DATASOURCE_NAME);
    await page.getByPlaceholder('Metric name or tags query').fill('{"find": "fields", "type": "keyword"}');
    await variableEditPage.runQuery();
    await expect(variableEditPage).toDisplayPreviews([/.+/]);
  });

  test('should return no values for an unsupported find type', async ({ variableEditPage, page }) => {
    await variableEditPage.datasource.set(DATASOURCE_NAME);
    await page.getByPlaceholder('Metric name or tags query').fill('{"find": "not-a-thing"}');
    await variableEditPage.runQuery();
    // Grafana 10.x renders a literal "None" placeholder for an empty result where newer
    // versions render nothing at all, so assert on the absence of real values instead.
    const previews = await page.getByTestId('data-testid Variable editor Preview of Values option').allTextContents();
    expect(previews.filter((preview) => preview !== 'None')).toEqual([]);
  });
});
