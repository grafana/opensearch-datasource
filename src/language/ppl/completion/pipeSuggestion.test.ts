import { monacoTypes } from '@grafana/ui';

import {
  eventstatsCountCompleteQuery,
  fieldsCompleteQuery,
  fieldsFunctionFieldQuery,
  fieldsTrailingCommaQuery,
  headCompleteQuery,
  sortCompleteQuery,
  sortDanglingOperatorQuery,
  sortFunctionFieldQuery,
  statsByCompleteQuery,
  statsByIncompleteQuery,
  statsCountCompleteQuery,
  statsCountTrailingCommaQuery,
  whereCompleteQuery,
  whereConditionCompleteQuery,
  whereDanglingAndQuery,
  whereFieldEqualsQuery,
} from '../../../__mocks__/ppl-test-data/singleLineQueries';
import MonacoMock from '../../../__mocks__/monarch/Monaco';
import TextModel from '../../../__mocks__/monarch/TextModel';
import { linkedTokenBuilder } from '../../monarch/linkedTokenBuilder';
import { PPLTokenTypes } from '../tokenTypes';
import openSearchPPLLanguageDefinition from '../definition';

import { canSuggestPipe } from './pipeSuggestion';

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

describe('canSuggestPipe', () => {
  it('returns true after a completed fields argument list', () => {
    expect(canSuggestPipe(generateToken(fieldsCompleteQuery.query, { lineNumber: 1, column: 14 }))).toBe(true);
  });

  it('returns false after a trailing comma in fields', () => {
    expect(canSuggestPipe(generateToken(fieldsTrailingCommaQuery.query, { lineNumber: 1, column: 15 }))).toBe(false);
  });

  it('returns true after a completed sort field', () => {
    expect(canSuggestPipe(generateToken(sortCompleteQuery.query, { lineNumber: 1, column: 15 }))).toBe(true);
  });

  it('returns false after a dangling sort +/- operator', () => {
    expect(canSuggestPipe(generateToken(sortDanglingOperatorQuery.query, { lineNumber: 1, column: 7 }))).toBe(false);
  });

  it('returns true after a fields argument whose name collides with a builtin function', () => {
    expect(canSuggestPipe(generateToken(fieldsFunctionFieldQuery.query, { lineNumber: 1, column: 13 }))).toBe(true);
  });

  it('returns true after a sort field whose name collides with a builtin function', () => {
    expect(canSuggestPipe(generateToken(sortFunctionFieldQuery.query, { lineNumber: 1, column: 13 }))).toBe(true);
  });

  it('returns true after a complete where comparison', () => {
    expect(canSuggestPipe(generateToken(whereCompleteQuery.query, { lineNumber: 1, column: 19 }))).toBe(true);
  });

  it('returns false after a dangling AND in where', () => {
    expect(canSuggestPipe(generateToken(whereDanglingAndQuery.query, { lineNumber: 1, column: 23 }))).toBe(false);
  });

  it('returns false after an incomplete where comparison', () => {
    expect(canSuggestPipe(generateToken(whereFieldEqualsQuery.query, { lineNumber: 1, column: 15 }))).toBe(false);
  });

  it('returns true after a closed where condition function', () => {
    expect(canSuggestPipe(generateToken(whereConditionCompleteQuery.query, { lineNumber: 1, column: 21 }))).toBe(true);
  });

  it('returns true after a closed stats function', () => {
    expect(canSuggestPipe(generateToken(statsCountCompleteQuery.query, { lineNumber: 1, column: 14 }))).toBe(true);
  });

  it('returns false after a dangling comma following a closed stats function', () => {
    expect(canSuggestPipe(generateToken(statsCountTrailingCommaQuery.query, { lineNumber: 1, column: 16 }))).toBe(
      false
    );
  });

  it('returns true after a closed eventstats function', () => {
    expect(canSuggestPipe(generateToken(eventstatsCountCompleteQuery.query, { lineNumber: 1, column: 20 }))).toBe(true);
  });

  it('returns true after a stats by field', () => {
    expect(canSuggestPipe(generateToken(statsByCompleteQuery.query, { lineNumber: 1, column: 22 }))).toBe(true);
  });

  it('returns false after stats by with no field', () => {
    expect(canSuggestPipe(generateToken(statsByIncompleteQuery.query, { lineNumber: 1, column: 17 }))).toBe(false);
  });

  it('returns false after head', () => {
    expect(canSuggestPipe(generateToken(headCompleteQuery.query, { lineNumber: 1, column: 8 }))).toBe(false);
  });

  it('returns false for null token', () => {
    expect(canSuggestPipe(null)).toBe(false);
  });
});
