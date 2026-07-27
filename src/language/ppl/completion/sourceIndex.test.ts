import { monacoTypes } from '@grafana/ui';

import {
  searchQuery,
  sourceEqualsQuery,
  sourceHyphenCompleteQuery,
  sourceHyphenIncompleteQuery,
  whereFieldEqualsQuery,
  whereHyphenFieldEqualsQuery,
  whereIndexEqualsHyphenQuery,
} from '../../../__mocks__/ppl-test-data/singleLineQueries';
import MonacoMock from '../../../__mocks__/monarch/Monaco';
import TextModel from '../../../__mocks__/monarch/TextModel';
import { linkedTokenBuilder } from '../../monarch/linkedTokenBuilder';
import { PPLTokenTypes } from '../tokenTypes';
import openSearchPPLLanguageDefinition from '../definition';

import { getFieldNameBeforeComparison, getSourceIndexFromTokens } from './sourceIndex';

function generateToken(query: string, position: monacoTypes.IPosition) {
  const testModel = TextModel(query);
  return linkedTokenBuilder(
    MonacoMock,
    openSearchPPLLanguageDefinition,
    testModel as monacoTypes.editor.ITextModel,
    position,
    PPLTokenTypes
  );
}

describe('getSourceIndexFromTokens', () => {
  it('returns a completed hyphenated index when cursor is after the name', () => {
    expect(
      getSourceIndexFromTokens(generateToken(sourceHyphenCompleteQuery.query, { lineNumber: 1, column: 19 }))
    ).toBe('logs-2024');
  });

  it('returns undefined when a hyphenated index name is incomplete', () => {
    expect(
      getSourceIndexFromTokens(generateToken(sourceHyphenIncompleteQuery.query, { lineNumber: 1, column: 15 }))
    ).toBeUndefined();
  });

  it('returns undefined when source = is incomplete', () => {
    expect(
      getSourceIndexFromTokens(generateToken(sourceEqualsQuery.query, { lineNumber: 1, column: 9 }))
    ).toBeUndefined();
  });

  it('does not treat where index = as a from-clause', () => {
    expect(
      getSourceIndexFromTokens(generateToken(whereIndexEqualsHyphenQuery.query, { lineNumber: 1, column: 24 }))
    ).toBeUndefined();
  });

  it('returns the index from SEARCH source = ...', () => {
    expect(getSourceIndexFromTokens(generateToken(searchQuery.query, { lineNumber: 1, column: 27 }))).toBe('inventory');
  });
});

describe('getFieldNameBeforeComparison', () => {
  it('returns a simple field name', () => {
    const token = generateToken(whereFieldEqualsQuery.query, { lineNumber: 1, column: 15 });
    const comparison = token?.getPreviousNonWhiteSpaceToken();
    expect(comparison && getFieldNameBeforeComparison(comparison)).toBe('status');
  });

  it('returns a hyphenated field name split across tokens', () => {
    const token = generateToken(whereHyphenFieldEqualsQuery.query, { lineNumber: 1, column: 16 });
    const comparison = token?.getPreviousNonWhiteSpaceToken();
    expect(comparison && getFieldNameBeforeComparison(comparison)).toBe('user-id');
  });
});
