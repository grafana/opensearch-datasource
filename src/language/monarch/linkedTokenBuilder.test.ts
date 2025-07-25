import { monacoTypes } from '@grafana/ui';

import MonacoMock from '../../__mocks__/monarch/Monaco';
import TextModel from '../../__mocks__/monarch/TextModel';
import { linkedTokenBuilder } from './linkedTokenBuilder';
import { PPLTokenTypes } from 'language/ppl/tokenTypes';
import openSearchPPLLanguageDefinition from 'language/ppl/definition';
import { whereQuery } from '__mocks__/ppl-test-data/singleLineQueries';
import { multiLineFullQuery } from '__mocks__/ppl-test-data/multilineQueries';
import { WHERE } from 'language/ppl/language';

describe('linkedTokenBuilder', () => {
  describe('singleLineFullQuery', () => {
    const testModel = TextModel(whereQuery.query);

    it('should add correct references to next LinkedToken', () => {
      const position: monacoTypes.IPosition = { lineNumber: 1, column: 0 };
      const current = linkedTokenBuilder(
        MonacoMock,
        openSearchPPLLanguageDefinition,
        testModel as monacoTypes.editor.ITextModel,
        position,
        PPLTokenTypes
      );

      expect(current?.is(PPLTokenTypes.Command, WHERE)).toBeTruthy();
      expect(current?.getNextNonWhiteSpaceToken()?.is(PPLTokenTypes.Function, 'like')).toBeTruthy();
    });

    it('should add correct references to previous LinkedToken', () => {
      const position: monacoTypes.IPosition = { lineNumber: 1, column: 43 }; // position before NOT
      const current = linkedTokenBuilder(
        MonacoMock,
        openSearchPPLLanguageDefinition,
        testModel as monacoTypes.editor.ITextModel,
        position,
        PPLTokenTypes
      );
      expect(current?.is(PPLTokenTypes.Operator, 'not')).toBeTruthy();
      expect(current?.getPreviousNonWhiteSpaceToken()?.is(PPLTokenTypes.Operator, 'AND')).toBeTruthy();
      expect(
        current?.getPreviousNonWhiteSpaceToken()?.getPreviousNonWhiteSpaceToken()?.is(PPLTokenTypes.Parenthesis)
      ).toBeTruthy();
    });
  });

  describe('multiLineFullQuery', () => {
    const testModel = TextModel(multiLineFullQuery.query);

    it('should add pipe token in case of empty lines', () => {
      const position: monacoTypes.IPosition = { lineNumber: 3, column: 0 };
      const current = linkedTokenBuilder(
        MonacoMock,
        openSearchPPLLanguageDefinition,
        testModel as monacoTypes.editor.ITextModel,
        position,
        PPLTokenTypes
      );
      expect(current).not.toBeNull();
      expect(current?.is(PPLTokenTypes.Pipe, '|')).toBeTruthy();
    });

    it('should add correct references to next LinkedToken', () => {
      const position: monacoTypes.IPosition = { lineNumber: 1, column: 0 };
      const current = linkedTokenBuilder(
        MonacoMock,
        openSearchPPLLanguageDefinition,
        testModel as monacoTypes.editor.ITextModel,
        position,
        PPLTokenTypes
      );
      expect(current?.is(PPLTokenTypes.Command)).toBeTruthy();
      expect(current?.getNextNonWhiteSpaceToken()?.is(PPLTokenTypes.Identifier, 'ingestionTime')).toBeTruthy();
    });

    it('should add correct references to previous LinkedToken even when references spans over multiple lines', () => {
      const position: monacoTypes.IPosition = { lineNumber: 6, column: 8 };
      const current = linkedTokenBuilder(
        MonacoMock,
        openSearchPPLLanguageDefinition,
        testModel as monacoTypes.editor.ITextModel,
        position,
        PPLTokenTypes
      );
      expect(current?.is(PPLTokenTypes.Operator, '-')).toBeTruthy();
      expect(current?.getPreviousNonWhiteSpaceToken()?.is(PPLTokenTypes.Command, 'sort')).toBeTruthy();
      expect(
        current?.getPreviousNonWhiteSpaceToken()?.getPreviousNonWhiteSpaceToken()?.is(PPLTokenTypes.Pipe)
      ).toBeTruthy();
    });
  });
});
