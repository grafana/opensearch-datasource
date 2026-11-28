import { Monaco, monacoTypes } from '@grafana/ui';

import {
  fromCompleteQuery,
  fromQuery,
  selectFunctionQuery,
  selectQuery,
  whereEqualsFunctionCallQuery,
  whereEqualsKeywordFieldQuery,
  whereEqualsNothingQuery,
  whereEqualsNumberQuery,
  whereEqualsShortFieldQuery,
  whereEqualsStringQuery,
  whereEqualsQuery,
  whereEqualsQuotedFieldQuery,
  whereGreaterThanQuery,
  whereEqualsDottedFieldQuery,
} from '../../../__mocks__/sql-test-data/singleLineQueries';
import MonacoMock from '../../../__mocks__/monarch/Monaco';
import TextModel from '../../../__mocks__/monarch/TextModel';
import { SQL_KEYWORDS, SQL_FUNCTIONS } from '../language';
import { SQLCompletionItemProvider } from './SQLCompletionItemProvider';
import { VariableModel } from '@grafana/schema';
import openSearchSQLLanguageDefinition from '../definition';

jest.mock('monaco-editor/esm/vs/editor/editor.api', () => ({
  Token: jest.fn((offset, type, language) => ({ offset, type, language })),
}));

const fieldNameVariable: VariableModel = {
  type: 'query',
  name: 'fieldName',
  current: { value: 'fieldName', text: 'fieldName', selected: true },
  multi: false,
};
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: jest.fn(() => ({
    getVariables: jest.fn().mockReturnValue([fieldNameVariable]),
  })),
}));

const indexFields = [
  { text: 'status_code', type: 'integer' },
  { text: 'bytes', type: 'long' },
  { text: 'status', type: 'integer' },
];
const indexFieldNames = ['status_code', 'bytes'];
const mockIndices = [{ index: 'e2e-logs', status: 'open', health: 'green', 'docs.count': '240' }];
const mockIndexNames = ['e2e-logs'];
const mockTerms = [{ text: '200', value: '200' }, { text: '500', value: '500' }];
const mockTermLabels = ['200', '500'];

const getFields = jest.fn().mockResolvedValue(indexFields);
const getIndices = jest.fn().mockResolvedValue(mockIndices);
const getTerms = jest.fn().mockResolvedValue(mockTerms);

const getSuggestions = async (value: string, position: monacoTypes.IPosition) => {
  const setup = new SQLCompletionItemProvider(getFields, getIndices, getTerms);

  const monaco = MonacoMock as Monaco;
  const provider = setup.getCompletionProvider(monaco, openSearchSQLLanguageDefinition);
  const { suggestions } = await provider.provideCompletionItems(
    TextModel(value) as monacoTypes.editor.ITextModel,
    position
  );
  return suggestions;
};

describe('SQLCompletionItemProvider', () => {
  beforeEach(() => {
    getFields.mockClear();
    getIndices.mockClear();
    getTerms.mockClear();
  });

  it('should suggest keywords and index names for an empty query', async () => {
    const suggestions = await getSuggestions('', { lineNumber: 1, column: 1 });
    const suggestionLabels = suggestions.map((s) => s.label);
    expect(suggestionLabels).toEqual(expect.arrayContaining([...SQL_KEYWORDS, ...mockIndexNames]));
    expect(suggestionLabels).toContain('$fieldName');
  });

  it('should suggest fields and functions after SELECT', async () => {
    const suggestions = await getSuggestions(selectQuery.query, { lineNumber: 1, column: 7 });
    const suggestionLabels = suggestions.map((s) => s.label);
    expect(suggestionLabels).toEqual(expect.arrayContaining(indexFieldNames));
    expect(suggestionLabels).toEqual(expect.arrayContaining(SQL_FUNCTIONS));
    expect(getFields).toHaveBeenCalled();
  });

  it('should suggest indices after FROM, not fields', async () => {
    const suggestions = await getSuggestions(fromQuery.query, { lineNumber: 1, column: 14 });
    const suggestionLabels = suggestions.map((s) => s.label);
    expect(suggestionLabels).toEqual(expect.arrayContaining(mockIndexNames));
    expect(suggestionLabels).not.toContain(expect.arrayContaining(indexFieldNames));
    expect(getIndices).toHaveBeenCalled();
  });

  it('should suggest field values after a comparison operator in WHERE', async () => {
    const suggestions = await getSuggestions(whereEqualsQuery.query, { lineNumber: 1, column: 35 });
    const suggestionLabels = suggestions.map((s) => s.label);
    expect(suggestionLabels).toEqual(expect.arrayContaining(mockTermLabels));
  });

  it('should read the fields and the terms of the table the query names', async () => {
    // A query can read a table other than the one the data source is set to, so
    // the completions belong to the table the query names.
    await getSuggestions(whereEqualsQuery.query, { lineNumber: 1, column: 35 });
    expect(getFields).toHaveBeenCalledWith('index');
    expect(getTerms).toHaveBeenCalledWith('status', 'index');
  });

  it('should ask for the terms of the field that is compared', async () => {
    await getSuggestions(whereEqualsQuery.query, { lineNumber: 1, column: 35 });
    expect(getTerms).toHaveBeenCalledWith('status', 'index');
  });

  it('should ask for the terms of a field that is quoted with a backtick', async () => {
    await getSuggestions(whereEqualsQuotedFieldQuery.query, { lineNumber: 1, column: 42 });
    expect(getTerms).toHaveBeenCalledWith('status_code', 'index');
  });

  it('should not ask for terms when the token before the operator is not a field', async () => {
    // A number, a literal or a closing parenthesis left of `=` is not a field,
    // and asking for its terms sends a request that cannot return anything.
    for (const query of [
      whereEqualsFunctionCallQuery.query,
      whereEqualsNumberQuery.query,
      whereEqualsNothingQuery.query,
      whereEqualsStringQuery.query,
    ]) {
      getTerms.mockClear();
      await getSuggestions(query, { lineNumber: 1, column: query.length + 1 });
      expect(getTerms).not.toHaveBeenCalled();
    }
  });

  it('should ask for the terms of a field that has a dot in its name', async () => {
    const dottedFields = jest.fn().mockResolvedValue([{ text: 'host.name' }, { text: 'host' }]);
    const dottedTerms = jest.fn().mockResolvedValue([{ text: 'web-1', value: 'web-1' }]);
    const setup = new SQLCompletionItemProvider(dottedFields, getIndices, dottedTerms);
    const provider = setup.getCompletionProvider(MonacoMock as Monaco, openSearchSQLLanguageDefinition);
    const query = whereEqualsDottedFieldQuery.query;
    await provider.provideCompletionItems(TextModel(query) as monacoTypes.editor.ITextModel, {
      lineNumber: 1,
      column: query.length + 1,
    });
    expect(dottedTerms).toHaveBeenCalledWith('host.name', 'index');
  });

  it('should write a numeric value without quotes', async () => {
    // The engine rejects `status_code = '500'` for an integer field.
    const numericTerms = jest.fn().mockResolvedValue([{ text: '500', value: 500 }]);
    const setup = new SQLCompletionItemProvider(getFields, getIndices, numericTerms);
    const provider = setup.getCompletionProvider(MonacoMock as Monaco, openSearchSQLLanguageDefinition);
    const query = whereEqualsQuery.query;
    const { suggestions } = await provider.provideCompletionItems(TextModel(query) as monacoTypes.editor.ITextModel, {
      lineNumber: 1,
      column: query.length + 1,
    });
    expect(suggestions.map((s) => s.label)).toContain('500');
    expect(suggestions.map((s) => s.label)).not.toContain("'500'");
  });

  it('should resolve a name the field list does not know without taking a longer field for it', async () => {
    // `name` is a field of its own: `host.name` ends with it, but it is a
    // different field.
    const fields = jest.fn().mockResolvedValue([{ text: 'host.name' }, { text: 'kubernetes.pod.name' }]);
    const terms = jest.fn().mockResolvedValue([]);
    const setup = new SQLCompletionItemProvider(fields, getIndices, terms);
    const provider = setup.getCompletionProvider(MonacoMock as Monaco, openSearchSQLLanguageDefinition);
    const query = whereEqualsShortFieldQuery.query;
    await provider.provideCompletionItems(TextModel(query) as monacoTypes.editor.ITextModel, {
      lineNumber: 1,
      column: query.length + 1,
    });
    expect(terms).toHaveBeenCalledWith('name', 'index');
  });

  it('should quote a value that belongs to a keyword field', async () => {
    // The engine rejects `level = 200` for a keyword field, even though the term
    // is written as a number: the quoting follows the field, not the value.
    const fields = jest.fn().mockResolvedValue([{ text: 'level', type: 'keyword' }]);
    const terms = jest.fn().mockResolvedValue([{ text: '200', value: 200 }]);
    const setup = new SQLCompletionItemProvider(fields, getIndices, terms);
    const provider = setup.getCompletionProvider(MonacoMock as Monaco, openSearchSQLLanguageDefinition);
    const query = whereEqualsKeywordFieldQuery.query;
    const { suggestions } = await provider.provideCompletionItems(TextModel(query) as monacoTypes.editor.ITextModel, {
      lineNumber: 1,
      column: query.length + 1,
    });
    expect(suggestions.map((s) => s.label)).toContain("'200'");
  });

  it('should not suggest values for an operator it does not know', async () => {
    await getSuggestions(whereGreaterThanQuery.query, { lineNumber: 1, column: 37 });
    expect(getTerms).not.toHaveBeenCalled();
  });

  it('should suggest keywords after a completed FROM clause', async () => {
    const suggestions = await getSuggestions(fromCompleteQuery.query, { lineNumber: 1, column: 20 });
    const suggestionLabels = suggestions.map((s) => s.label);
    expect(suggestionLabels).toEqual(expect.arrayContaining([...SQL_KEYWORDS]));
    expect(getIndices).not.toHaveBeenCalled();
  });

  it('should suggest function snippets with parentheses', async () => {
    const suggestions = await getSuggestions(selectFunctionQuery.query, { lineNumber: 1, column: 13 });
    const functionSuggestion = suggestions.find((s) => s.label === 'count');
    expect(functionSuggestion?.insertText).toBe('count($0)');
  });
});
