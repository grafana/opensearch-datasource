import { resolveAggregatableTermsField, isSuggestablePplField } from './aggregatableField';

describe('resolveAggregatableTermsField', () => {
  it('returns the field unchanged when it is already aggregatable (no multi-field needed)', () => {
    expect(resolveAggregatableTermsField('status', ['status', 'bytes'])).toBe('status');
  });

  it('prefers field.keyword when present for a text field', () => {
    expect(
      resolveAggregatableTermsField('audit_node_name', ['audit_node_name', 'audit_node_name.keyword', 'status'])
    ).toBe('audit_node_name.keyword');
  });

  it('falls back to field.raw when keyword is absent', () => {
    expect(resolveAggregatableTermsField('message', ['message', 'message.raw'])).toBe('message.raw');
  });

  it('prefers .keyword over .raw when both exist', () => {
    expect(resolveAggregatableTermsField('title', ['title', 'title.raw', 'title.keyword'])).toBe('title.keyword');
  });

  it('returns the field unchanged when already a multi-field path', () => {
    expect(
      resolveAggregatableTermsField('audit_node_name.keyword', ['audit_node_name', 'audit_node_name.keyword'])
    ).toBe('audit_node_name.keyword');
  });

  it('resolves keyword for dotted field names', () => {
    expect(
      resolveAggregatableTermsField('integration-instance.name', [
        'integration-instance.name',
        'integration-instance.name.keyword',
      ])
    ).toBe('integration-instance.name.keyword');
  });

  it('returns the field unchanged when no aggregatable sibling exists', () => {
    expect(resolveAggregatableTermsField('audit_node_name', ['audit_node_name', 'status'])).toBe('audit_node_name');
  });

  it('does not pick an unrelated field that only shares a prefix', () => {
    expect(resolveAggregatableTermsField('host', ['host', 'hostName', 'hostName.keyword', 'hostname.keyword'])).toBe(
      'host'
    );
  });
});

describe('isSuggestablePplField', () => {
  it('keeps normal fields', () => {
    expect(isSuggestablePplField('audit_node_name')).toBe(true);
    expect(isSuggestablePplField('status')).toBe(true);
    expect(isSuggestablePplField('integration-instance.name')).toBe(true);
  });

  it('hides aggregatable multi-field suffixes used only for terms/aggs', () => {
    expect(isSuggestablePplField('audit_node_name.keyword')).toBe(false);
    expect(isSuggestablePplField('message.raw')).toBe(false);
    expect(isSuggestablePplField('integration-instance.name.keyword')).toBe(false);
  });
});
