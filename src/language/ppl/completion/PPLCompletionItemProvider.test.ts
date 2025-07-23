import { Monaco, monacoTypes } from '@grafana/ui';

import { newCommandQuery } from '../../../__mocks__/ppl-test-data/newCommandQuery';
import {
  dedupQueryWithOptionalArgs,
  emptyQuery,
  evalQuery,
  fieldsQuery,
  headQuery,
  parseQuery,
  queryWithArithmeticOps,
  queryWithFunctionCalls,
  queryWithFieldList,
  sortQuery,
  statsQuery,
  topQuery,
  whereQuery,
  searchQuery,
  rareQuery,
  eventStatsQuery,
} from '../../../__mocks__/ppl-test-data/singleLineQueries';
import MonacoMock from '../../../__mocks__/monarch/Monaco';
import TextModel from '../../../__mocks__/monarch/TextModel';
import {
  BOOLEAN_LITERALS,
  CONDITION_FUNCTIONS,
  DEDUP_PARAMETERS,
  EVAL_FUNCTIONS,
  FIELD_OPERATORS,
  NOT,
  PPL_COMMANDS,
  SORT_FIELD_FUNCTIONS,
  SPAN,
  STATS_PARAMETERS,
  STATS_FUNCTIONS,
  FROM,
  INDEX,
  SOURCE,
  COUNTFIELD,
  SHOWCOUNT,
  WINDOW_STATS_FUNCTIONS,
} from '../language';

import { PPLCompletionItemProvider } from './PPLCompletionItemProvider';
import { VariableModel } from '@grafana/schema';
import openSearchPPLLanguageDefinition from '../definition';

export const fieldNameVariable: VariableModel = {
  type: 'query',
  name: 'fieldName',
  current: { value: 'avgBytes', text: 'avgBytes', selected: true },
  multi: false,
};
jest.mock('monaco-editor/esm/vs/editor/editor.api', () => ({
  Token: jest.fn((offset, type, language) => ({ offset, type, language })),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: jest.fn(() => ({
    getVariables: jest.fn().mockReturnValue([fieldNameVariable]),
  })),
}));
const indexFields = [{ text: 'avgTicketPrice' }, { text: 'distance' }];
const indexFieldNames = ['avgTicketPrice', 'distance'];

const getFields = jest.fn().mockResolvedValue(indexFields);

const getSuggestions = async (value: string, position: monacoTypes.IPosition) => {
  const setup = new PPLCompletionItemProvider(getFields);

  const monaco = MonacoMock as Monaco;
  const provider = setup.getCompletionProvider(monaco, openSearchPPLLanguageDefinition);
  const { suggestions } = await provider.provideCompletionItems(
    TextModel(value) as monacoTypes.editor.ITextModel,
    position
  );
  return suggestions;
};

describe('PPLCompletionItemProvider', () => {
  describe('getSuggestions', () => {
    it('should suggest commands for an empty query', async () => {
      const suggestions = await getSuggestions(emptyQuery.query, { lineNumber: 1, column: 1 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(PPL_COMMANDS));
    });

    it('should suggest commands for a query when a new command is started', async () => {
      const suggestions = await getSuggestions(newCommandQuery.query, { lineNumber: 1, column: 20 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(PPL_COMMANDS));
    });

    describe('SuggestionKind.ValueExpression', () => {
      test.each([
        [queryWithFunctionCalls.query, { lineNumber: 1, column: 20 }],
        [queryWithFunctionCalls.query, { lineNumber: 1, column: 59 }],
        [queryWithFunctionCalls.query, { lineNumber: 1, column: 78 }],
        [queryWithArithmeticOps.query, { lineNumber: 1, column: 14 }],
        [whereQuery.query, { lineNumber: 1, column: 71 }],
      ])('should suggest functions and fields as argument for value expression', async (query, position) => {
        const suggestions = await getSuggestions(query, position);
        const suggestionLabels = suggestions.map((s) => s.label);
        expect(suggestionLabels).toEqual(expect.arrayContaining([...EVAL_FUNCTIONS, ...indexFieldNames]));
      });
    });

    describe('[SuggestioKind.Field]', () => {
      test.each([
        [evalQuery.query, { lineNumber: 1, column: 5 }],
        [fieldsQuery.query, { lineNumber: 1, column: 9 }],
        [topQuery.query, { lineNumber: 1, column: 36 }],
        [queryWithFieldList.query, { lineNumber: 1, column: 22 }],
        [statsQuery.query, { lineNumber: 1, column: 10 }],
      ])('should suggest fields for SuggestionKind.Field', async (query, position) => {
        const suggestions = await getSuggestions(query, position);
        const suggestionLabels = suggestions.map((s) => s.label);
        expect(suggestionLabels).toEqual(expect.arrayContaining(indexFieldNames));
      });
    });

    it('should suggest top command parameters after TOP command number or RARE command', async () => {
      const topSggestions = await getSuggestions(topQuery.query, { lineNumber: 1, column: 4 });
      const suggestionLabels = topSggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([COUNTFIELD, SHOWCOUNT]));

      const rareSuggestions = await getSuggestions(rareQuery.query, { lineNumber: 1, column: 5 });
      const rareSuggestionLabels = rareSuggestions.map((s) => s.label);
      expect(rareSuggestionLabels).toEqual(expect.arrayContaining([COUNTFIELD, SHOWCOUNT]));
    });

    it('should suggest from clause after HEAD command', async () => {
      const suggestions = await getSuggestions(headQuery.query, { lineNumber: 1, column: 5 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual([FROM, `$${fieldNameVariable.name}`]);
    });
    it('should suggest search from clause after SEARCH command', async () => {
      const suggestions = await getSuggestions(searchQuery.query, { lineNumber: 1, column: 7 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([SOURCE, INDEX]));
    });

    it('should suggest stats parameters after STATS command', async () => {
      const suggestions = await getSuggestions(statsQuery.query, { lineNumber: 1, column: 6 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([...STATS_PARAMETERS, ...STATS_FUNCTIONS]));
      expect(suggestionLabels).not.toContain('avgTicketPrice');
    });

    it('should suggest fields, field operators and sort functions when in a sort field position', async () => {
      const suggestions = await getSuggestions(sortQuery.query, { lineNumber: 1, column: 5 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(
        expect.arrayContaining([...FIELD_OPERATORS, ...SORT_FIELD_FUNCTIONS, ...indexFieldNames])
      );
    });

    it('should suggest field operators and fields after FIELDS command', async () => {
      const suggestions = await getSuggestions(fieldsQuery.query, { lineNumber: 1, column: 7 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([...FIELD_OPERATORS, ...indexFieldNames]));
    });

    it('should suggest boolean literals after boolean argument', async () => {
      const suggestions = await getSuggestions(dedupQueryWithOptionalArgs.query, { lineNumber: 1, column: 53 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(
        expect.arrayContaining(BOOLEAN_LITERALS.map((booleanLiteral) => `= ${booleanLiteral}`))
      );
    });

    it('should suggest dedup parameters after DEDUP field names', async () => {
      const suggestions = await getSuggestions(dedupQueryWithOptionalArgs.query, { lineNumber: 1, column: 43 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(DEDUP_PARAMETERS));
    });

    it('should suggest fields and span function after STATS BY', async () => {
      const suggestions = await getSuggestions(statsQuery.query, { lineNumber: 1, column: 42 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([SPAN, ...indexFieldNames]));
    });

    it('should suggest fields and sort functions after SORT field operator', async () => {
      const suggestions = await getSuggestions(sortQuery.query, { lineNumber: 1, column: 7 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([...SORT_FIELD_FUNCTIONS, ...indexFieldNames]));
    });

    it('should suggest PPL functions, NOT, case and fields in Expression clauses', async () => {
      const parseSuggestions = await getSuggestions(parseQuery.query, { lineNumber: 1, column: 6 });
      const parseSuggestionLabels = parseSuggestions.map((s) => s.label);
      expect(parseSuggestionLabels).toEqual(
        expect.arrayContaining([...EVAL_FUNCTIONS, ...CONDITION_FUNCTIONS, NOT, ...indexFieldNames])
      );
    });

    it('should suggest functions, fields and boolean functions in a logical expression', async () => {
      const whereSuggestions = await getSuggestions(whereQuery.query, { lineNumber: 1, column: 6 });
      let suggestionLabels = whereSuggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(
        expect.arrayContaining([...CONDITION_FUNCTIONS, ...EVAL_FUNCTIONS, ...indexFieldNames])
      );

      const searchSuggestions = await getSuggestions(searchQuery.query, { lineNumber: 1, column: 7 });
      const searchSuggestionLabels = searchSuggestions.map((s) => s.label);
      expect(searchSuggestionLabels).toEqual(
        expect.arrayContaining([...CONDITION_FUNCTIONS, ...EVAL_FUNCTIONS, ...indexFieldNames])
      );

      const evalSuggestions = await getSuggestions(evalQuery.query, { lineNumber: 1, column: 21 });
      const evalSuggestionLabels = evalSuggestions.map((s) => s.label);
      expect(evalSuggestionLabels).toEqual(
        expect.arrayContaining([...EVAL_FUNCTIONS, ...CONDITION_FUNCTIONS, NOT, ...indexFieldNames])
      );
    });

    it('should suggest window functions after EVENTSTATS command', async () => {
      const suggestions = await getSuggestions(eventStatsQuery.query, { lineNumber: 1, column: 11 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual([...WINDOW_STATS_FUNCTIONS, `$${fieldNameVariable.name}`]);
    });

    it('should suggest template variables appended to list of suggestions', async () => {
      const suggestions = await getSuggestions(sortQuery.query, { lineNumber: 1, column: 7 });
      const suggestionLabels = suggestions.map((s) => s.label);
      const expectedTemplateVariableLabel = `$${fieldNameVariable.name}`;
      const expectedLabels = [...SORT_FIELD_FUNCTIONS, ...indexFieldNames, expectedTemplateVariableLabel];
      expect(suggestionLabels).toEqual(expect.arrayContaining(expectedLabels));
    });
  });
});
