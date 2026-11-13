import { expect, test } from '@grafana/plugin-e2e';
import { DATASOURCE_NAME } from './helpers';

/**
 * A query variable holds a JSON query, and the editor the plugin provides keeps showing it in
 * a text area. The switch at the top of the editor turns the variable into a SQL one; the
 * JSON query is then replaced, because a JSON query is not SQL.
 *
 * Only `find: fields` is asserted on here. A `find: terms` lookup is bounded by the dashboard
 * time range, and the variable editor opens a new dashboard fixed at `now-6h` with no way to
 * override it before the preview runs — so it can never reach the fixture window, which is
 * pinned in the past by design.
 */
test.describe('Variable editor', () => {
  test('should resolve a fields query', async ({ variableEditPage, page }) => {
    await variableEditPage.datasource.set(DATASOURCE_NAME);
    await page.getByLabel('JSON query for the variable values').fill('{"find": "fields", "type": "keyword"}');
    await variableEditPage.runQuery();
    await expect(variableEditPage).toDisplayPreviews([/.+/]);
  });

  test('should return no values for an unsupported find type', async ({ variableEditPage, page }) => {
    await variableEditPage.datasource.set(DATASOURCE_NAME);
    await page.getByLabel('JSON query for the variable values').fill('{"find": "not-a-thing"}');
    await variableEditPage.runQuery();
    // Grafana 10.x renders a literal "None" placeholder for an empty result where newer
    // versions render nothing at all, so assert on the absence of real values instead.
    const previews = await page.getByTestId('data-testid Variable editor Preview of Values option').allTextContents();
    expect(previews.filter((preview) => preview !== 'None')).toEqual([]);
  });

  test('should replace the JSON query with a SQL editor when switched to SQL', async ({ variableEditPage, page }) => {
    await variableEditPage.datasource.set(DATASOURCE_NAME);
    await page.getByLabel('JSON query for the variable values').fill('{"find": "fields", "type": "keyword"}');

    // The switch's input is visually hidden behind its styled label.
    await page.locator('#variable-query-type').check({ force: true });

    // The JSON query is replaced rather than converted, and the SQL editor takes its place.
    await expect(page.getByLabel('JSON query for the variable values')).toHaveCount(0);
    // The editor mounts asynchronously and Grafana keeps a rename widget of the same class
    // around, so the code editor is addressed by its role.
    await expect(page.getByRole('code')).toBeAttached();
  });
});
