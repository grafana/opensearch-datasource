/**
 * Prefer an aggregatable multi-field for terms aggregations while leaving the
 * query field name unchanged (e.g. `where audit_node_name =` still uses the text field).
 *
 * OpenSearch/ES text fields are not aggregatable by default; values live on `.keyword`
 * (or older `.raw`) multi-fields. See datasource docs for template-variable guidance.
 */
export function resolveAggregatableTermsField(field: string, availableFields: string[]): string {
  const keyword = `${field}.keyword`;
  if (availableFields.includes(keyword)) {
    return keyword;
  }

  const raw = `${field}.raw`;
  if (availableFields.includes(raw)) {
    return raw;
  }

  return field;
}

/** Multi-field suffixes used for aggregations/sorting — hide from PPL field suggestions. */
const AGGREGATABLE_MULTI_FIELD_SUFFIXES = ['.keyword', '.raw'];

/**
 * Whether a field name should appear in PPL field autocomplete.
 * Hides `.keyword` / `.raw` multi-fields; value suggestions still resolve them under the hood.
 */
export function isSuggestablePplField(fieldName: string): boolean {
  return !AGGREGATABLE_MULTI_FIELD_SUFFIXES.some((suffix) => fieldName.endsWith(suffix));
}
