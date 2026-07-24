import { monacoTypes } from '@grafana/ui';

import {
  indexThenWhereQuery,
  searchQuery,
  sourceDottedThenFieldsQuery,
  sourceEqualsQuery,
  sourceHyphenCompleteQuery,
  sourceHyphenIncompleteQuery,
  sourceHyphenKeywordThenFieldsQuery,
  sourceThenFieldsQuery,
  sourceThenWhereEqualsQuery,
  whereFieldEqualsQuery,
  whereIndexEqualsHyphenQuery,
} from '../../../__mocks__/ppl-test-data/singleLineQueries';
import MonacoMock from '../../../__mocks__/monarch/Monaco';
import TextModel from '../../../__mocks__/monarch/TextModel';
import { linkedTokenBuilder } from '../../monarch/linkedTokenBuilder';
import { PPLTokenTypes } from '../tokenTypes';
import openSearchPPLLanguageDefinition from '../definition';

import { getSourceIndexFromTokens } from './sourceIndex';

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
  it('returns the index after a completed source = clause when cursor is after fields', () => {
    expect(getSourceIndexFromTokens(generateToken(sourceThenFieldsQuery.query, { lineNumber: 1, column: 28 }))).toBe(
      'inventory'
    );
  });

  it('returns a hyphenated index name split across identifier/operator/number tokens', () => {
    expect(getSourceIndexFromTokens(generateToken(indexThenWhereQuery.query, { lineNumber: 1, column: 26 }))).toBe(
      'logs-2024'
    );
  });

  it('returns a dotted index name when a segment tokenizes as a keyword', () => {
    expect(
      getSourceIndexFromTokens(generateToken(sourceDottedThenFieldsQuery.query, { lineNumber: 1, column: 27 }))
    ).toBe('my.index');
  });

  it('returns a hyphenated index name when a segment tokenizes as a keyword', () => {
    expect(
      getSourceIndexFromTokens(generateToken(sourceHyphenKeywordThenFieldsQuery.query, { lineNumber: 1, column: 30 }))
    ).toBe('logs-by-day');
  });

  it('returns undefined when source = is incomplete', () => {
    expect(
      getSourceIndexFromTokens(generateToken(sourceEqualsQuery.query, { lineNumber: 1, column: 9 }))
    ).toBeUndefined();
  });

  it('returns undefined when a hyphenated index name is incomplete', () => {
    expect(
      getSourceIndexFromTokens(generateToken(sourceHyphenIncompleteQuery.query, { lineNumber: 1, column: 15 }))
    ).toBeUndefined();
  });

  it('returns undefined when there is no source/index clause', () => {
    expect(
      getSourceIndexFromTokens(generateToken(whereFieldEqualsQuery.query, { lineNumber: 1, column: 15 }))
    ).toBeUndefined();
  });

  it('does not treat where index = as a from-clause', () => {
    expect(
      getSourceIndexFromTokens(generateToken(whereIndexEqualsHyphenQuery.query, { lineNumber: 1, column: 24 }))
    ).toBeUndefined();
  });

  it('still finds source = when cursor is mid-where comparison', () => {
    expect(
      getSourceIndexFromTokens(generateToken(sourceThenWhereEqualsQuery.query, { lineNumber: 1, column: 36 }))
    ).toBe('inventory');
  });

  it('returns a completed hyphenated index when cursor is after the name', () => {
    expect(
      getSourceIndexFromTokens(generateToken(sourceHyphenCompleteQuery.query, { lineNumber: 1, column: 19 }))
    ).toBe('logs-2024');
  });

  it('returns the index from SEARCH source = ...', () => {
    expect(getSourceIndexFromTokens(generateToken(searchQuery.query, { lineNumber: 1, column: 27 }))).toBe('inventory');
  });
});
