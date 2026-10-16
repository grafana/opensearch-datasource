import { Monaco, monacoTypes } from '@grafana/ui';

import { fromCompleteQuery, fromQuery, selectFunctionQuery, selectQuery, whereEqualsQuery } from '../../../__mocks__/sql-test-data/singleLineQueries';
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

const indexFields = [{ text: 'status_code' }, { text: 'bytes' }];
const indexFieldNames = ['status_code', 'bytes'];
const mockIndices = [{ index: 'e2e-logs', status: 'open', health: 'green', 'docs.count': '240' }];
const mockIndexNames = ['e2e-logs'];
const mockTerms = [{ text: '200' }, { text: '500' }];
const mockTermLabels = ["'200'", "'500'"];

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
    expect(getTerms).toHaveBeenCalledWith('');
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
