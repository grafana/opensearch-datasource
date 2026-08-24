import { expect, test } from '@grafana/plugin-e2e';
import { DATASOURCE_NAME } from './helpers';

test.describe('Annotation editor', () => {
  test('should render the annotation query editor', async ({ annotationEditPage, page, selectors }) => {
    await annotationEditPage.datasource.set(DATASOURCE_NAME);
    await expect(page.getByTestId(selectors.components.QueryField.container)).toBeVisible();
  });

  test('should render the field mappings', async ({ annotationEditPage, page }) => {
    await annotationEditPage.datasource.set(DATASOURCE_NAME);
    await expect(page.getByRole('heading', { name: 'Field mappings' })).toBeVisible();
    for (const label of ['Time', 'Time End', 'Text', 'Tags']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByPlaceholder('@timestamp')).toBeVisible();
    await expect(page.getByPlaceholder('tags')).toBeVisible();
  });

  test('should accept a Lucene query', async ({ annotationEditPage, page, selectors }) => {
    await annotationEditPage.datasource.set(DATASOURCE_NAME);
    // The query field is Slate-based, so fill() does not work — type into it instead.
    const queryField = page.getByTestId(selectors.components.QueryField.container);
    await queryField.click();
    await page.keyboard.type('level:error');
    await expect(queryField).toContainText('level:error');
  });
});
