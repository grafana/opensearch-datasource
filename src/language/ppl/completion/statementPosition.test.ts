import { monacoTypes } from '@grafana/ui';

import { multiLineFullQuery } from '../../../__mocks__/ppl-test-data/multilineQueries';
import {
  dedupQueryWithOptionalArgs,
  dedupQueryWithoutOptionalArgs,
  evalQuery,
  eventStatsQuery,
  fieldsQuery,
  headQuery,
  parseQuery,
  queryWithArithmeticOps,
  queryWithFunctionCalls,
  queryWithFieldList,
  queryWithLogicalExpression,
  rareQuery,
  sortQuery,
  sortQueryWithFunctions,
  statsQuery,
  topQuery,
  whereQuery,
  searchQuery,
  searchQueryWithIndexClause,
  joinQuery,
  renameQuery,
  grokQuery,
  patternsQuery,
  lookupQuery,
  kmeansQuery,
  adQuery,
  mlQuery,
  fillNullWithQuery,
  fillNullUsingQuery,
  trendlineQuery,
  appendColQuery,
  reverseQuery,
  flattenQuery,
  expandQuery,
} from '../../../__mocks__/ppl-test-data/singleLineQueries';
import MonacoMock from '../../../__mocks__/monarch/Monaco';
import TextModel from '../../../__mocks__/monarch/TextModel';
import { linkedTokenBuilder } from '../../monarch/linkedTokenBuilder';
import { StatementPosition } from '../../monarch/types';
import { PPLTokenTypes } from '../tokenTypes';

import { getStatementPosition } from './statementPosition';
import openSearchPPLLanguageDefinition from '../definition';

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

describe('getStatementPosition', () => {
  describe('search command', () => {
    it('should return StatementPosition.AfterSearchCommand after the search command', () => {
      expect(getStatementPosition(generateToken(searchQuery.query, { lineNumber: 1, column: 7 }))).toEqual(
        StatementPosition.AfterSearchCommand
      );
    });
    it('should return StatementPosition.AfterFromClause after source = clause', () => {
      expect(getStatementPosition(generateToken(searchQuery.query, { lineNumber: 1, column: 27 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
    });
    it('should return StatementPosition.AfterFromClause after index = clause', () => {
      expect(
        getStatementPosition(generateToken(searchQueryWithIndexClause.query, { lineNumber: 1, column: 25 }))
      ).toEqual(StatementPosition.BeforeLogicalExpression);
    });
  });
  it('should return StatementPosition.AfterArithmeticOperator if the position follows an arithmetic operator and not a fields or sort command', () => {
    expect(getStatementPosition(generateToken(queryWithArithmeticOps.query, { lineNumber: 1, column: 14 }))).toEqual(
      StatementPosition.AfterArithmeticOperator
    );
    expect(
      getStatementPosition(generateToken(queryWithArithmeticOps.query, { lineNumber: 1, column: 26 }))
    ).not.toEqual(StatementPosition.AfterArithmeticOperator);
    expect(getStatementPosition(generateToken(fieldsQuery.query, { lineNumber: 1, column: 9 }))).not.toEqual(
      StatementPosition.AfterArithmeticOperator
    );
    expect(getStatementPosition(generateToken(sortQuery.query, { lineNumber: 1, column: 7 }))).not.toEqual(
      StatementPosition.AfterArithmeticOperator
    );
  });

  it('should return StatementPosition.AfterBooleanAgument if the position follows a boolean argument', () => {
    expect(
      getStatementPosition(generateToken(dedupQueryWithOptionalArgs.query, { lineNumber: 1, column: 53 }))
    ).toEqual(StatementPosition.AfterBooleanArgument);
  });

  it('should return StatementPosition.FieldList if the position follows a comma and field identifiers and is not sort or eval command', () => {
    expect(getStatementPosition(generateToken(queryWithFieldList.query, { lineNumber: 1, column: 22 }))).toEqual(
      StatementPosition.FieldList
    );
    expect(getStatementPosition(generateToken(queryWithFieldList.query, { lineNumber: 1, column: 41 }))).toEqual(
      StatementPosition.FieldList
    );
    expect(getStatementPosition(generateToken(queryWithFieldList.query, { lineNumber: 1, column: 44 }))).toEqual(
      StatementPosition.FieldList
    );
    expect(getStatementPosition(generateToken(sortQuery.query, { lineNumber: 1, column: 53 }))).not.toEqual(
      StatementPosition.FieldList
    );
    expect(getStatementPosition(generateToken(evalQuery.query, { lineNumber: 1, column: 53 }))).not.toEqual(
      StatementPosition.FieldList
    );
  });

  it('should return StatementPosition.AfterInKeyword if the position follows IN', () => {
    expect(getStatementPosition(generateToken(whereQuery.query, { lineNumber: 1, column: 71 }))).toEqual(
      StatementPosition.AfterINKeyword
    );
  });

  it('should return StatementPosition.StatementPosition.FunctionArg if the position is inside a condition function', () => {
    expect(getStatementPosition(generateToken(queryWithFunctionCalls.query, { lineNumber: 1, column: 20 }))).toEqual(
      StatementPosition.FunctionArg
    );
    expect(getStatementPosition(generateToken(queryWithFunctionCalls.query, { lineNumber: 1, column: 11 }))).toEqual(
      StatementPosition.FunctionArg
    );
  });

  it('should return StatementPosition.StatementPosition.FunctionArg if the position is inside an evalFunction', () => {
    expect(getStatementPosition(generateToken(queryWithFunctionCalls.query, { lineNumber: 1, column: 59 }))).toEqual(
      StatementPosition.FunctionArg
    );
    expect(getStatementPosition(generateToken(queryWithFunctionCalls.query, { lineNumber: 1, column: 78 }))).toEqual(
      StatementPosition.FunctionArg
    );
  });

  describe('logical expression', () => {
    it('should return StatementPosition.BeforeLogicalExpression if the position follows a logical expression operator and is not an eval command', () => {
      expect(
        getStatementPosition(generateToken(queryWithLogicalExpression.query, { lineNumber: 1, column: 28 }))
      ).toEqual(StatementPosition.BeforeLogicalExpression);

      expect(getStatementPosition(generateToken(evalQuery.query, { lineNumber: 1, column: 30 }))).not.toEqual(
        StatementPosition.BeforeLogicalExpression
      );
      expect(getStatementPosition(generateToken(searchQuery.query, { lineNumber: 1, column: 36 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
    });

    it('should return StatementPosition.BeforeLogicalExpression after a logical expression operator', () => {
      expect(getStatementPosition(generateToken(whereQuery.query, { lineNumber: 1, column: 42 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
      expect(getStatementPosition(generateToken(searchQuery.query, { lineNumber: 1, column: 51 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
      expect(getStatementPosition(generateToken(searchQuery.query, { lineNumber: 1, column: 83 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
    });

    it('should return StatementPosition.BeforeLogicalExpression after a condition function', () => {
      expect(getStatementPosition(generateToken(whereQuery.query, { lineNumber: 1, column: 38 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
      expect(getStatementPosition(generateToken(searchQuery.query, { lineNumber: 1, column: 111 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
    });

    it('should return StatementPosition.BeforeLogicalExpression after a regex', () => {
      expect(
        getStatementPosition(generateToken(queryWithLogicalExpression.query, { lineNumber: 1, column: 43 }))
      ).toEqual(StatementPosition.BeforeLogicalExpression);
    });
    it('should return StatementPosition.BeforeLogicalExpression after a NOT operator', () => {
      expect(getStatementPosition(generateToken(whereQuery.query, { lineNumber: 1, column: 46 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );

      expect(
        getStatementPosition(generateToken(queryWithLogicalExpression.query, { lineNumber: 1, column: 32 }))
      ).toEqual(StatementPosition.BeforeLogicalExpression);

      expect(getStatementPosition(generateToken(searchQuery.query, { lineNumber: 1, column: 51 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
    });

    it('should return Statementposition.FunctionArg after a BETWEEN keyword', () => {
      expect(getStatementPosition(generateToken(evalQuery.query, { lineNumber: 1, column: 106 }))).toEqual(
        StatementPosition.FunctionArg
      );
    });
  });

  describe('WHERE command', () => {
    it('should return StatementPosition.BeforeLogicalExpression after where command', () => {
      expect(getStatementPosition(generateToken(whereQuery.query, { lineNumber: 1, column: 6 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 2, column: 8 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
    });
  });

  describe('FIELDS command', () => {
    it('should return StatementPosition.AfterFieldsCommand after fields command', () => {
      expect(getStatementPosition(generateToken(fieldsQuery.query, { lineNumber: 1, column: 7 }))).toEqual(
        StatementPosition.AfterFieldsCommand
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 3, column: 9 }))).toEqual(
        StatementPosition.AfterFieldsCommand
      );
    });

    it('should return StatementPosition.FieldList after a + operator', () => {
      expect(getStatementPosition(generateToken(fieldsQuery.query, { lineNumber: 1, column: 9 }))).toEqual(
        StatementPosition.FieldList
      );
    });

    it('should return StatementPosition.FieldList after a field', () => {
      expect(getStatementPosition(generateToken(fieldsQuery.query, { lineNumber: 1, column: 27 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(fieldsQuery.query, { lineNumber: 1, column: 38 }))).toEqual(
        StatementPosition.FieldList
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 3, column: 29 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 3, column: 40 }))).toEqual(
        StatementPosition.FieldList
      );
    });
  });

  describe('STATS command', () => {
    it('should return StatementPosition.AfterStatsCommand after stats command', () => {
      expect(getStatementPosition(generateToken(statsQuery.query, { lineNumber: 1, column: 6 }))).toEqual(
        StatementPosition.AfterStatsCommand
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 4, column: 8 }))).toEqual(
        StatementPosition.AfterStatsCommand
      );
    });

    it('should return StatementPosition.AfterStatsBy after by keyword', () => {
      expect(getStatementPosition(generateToken(statsQuery.query, { lineNumber: 1, column: 42 }))).toEqual(
        StatementPosition.AfterStatsBy
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 4, column: 44 }))).toEqual(
        StatementPosition.AfterStatsBy
      );
    });

    it('should return StatementPosition.FieldList in span function arguments', () => {
      expect(getStatementPosition(generateToken(statsQuery.query, { lineNumber: 1, column: 47 }))).toEqual(
        StatementPosition.FieldList
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 4, column: 49 }))).toEqual(
        StatementPosition.FieldList
      );
    });

    it('should return StatementPosition.StatsFunctionArgument in span function arguments', () => {
      expect(getStatementPosition(generateToken(statsQuery.query, { lineNumber: 1, column: 10 }))).toEqual(
        StatementPosition.StatsFunctionArgument
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 4, column: 12 }))).toEqual(
        StatementPosition.StatsFunctionArgument
      );
    });
  });

  describe('EVENTSTATS command', () => {
    it('should return StatementPosition.AfterEventStatsCommand after eventstats command', () => {
      expect(getStatementPosition(generateToken(eventStatsQuery.query, { lineNumber: 1, column: 11 }))).toEqual(
        StatementPosition.AfterEventStatsCommand
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 5, column: 13 }))).toEqual(
        StatementPosition.AfterEventStatsCommand
      );
    });

    it('should return StatementPosition.AfterStatsBy after by keyword', () => {
      expect(getStatementPosition(generateToken(eventStatsQuery.query, { lineNumber: 1, column: 47 }))).toEqual(
        StatementPosition.AfterStatsBy
      );

      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 5, column: 49 }))).toEqual(
        StatementPosition.AfterStatsBy
      );
    });

    it('should return StatementPosition.FieldList in span function arguments', () => {
      expect(getStatementPosition(generateToken(eventStatsQuery.query, { lineNumber: 1, column: 52 }))).toEqual(
        StatementPosition.FieldList
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 5, column: 54 }))).toEqual(
        StatementPosition.FieldList
      );
    });

    it('should return StatementPosition.StatsFunctionArgument in span function arguments', () => {
      expect(getStatementPosition(generateToken(eventStatsQuery.query, { lineNumber: 1, column: 15 }))).toEqual(
        StatementPosition.StatsFunctionArgument
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 5, column: 17 }))).toEqual(
        StatementPosition.StatsFunctionArgument
      );
    });
  });

  describe('SORT command', () => {
    it('should return StatementPosition.SortField as a sort clause', () => {
      expect(getStatementPosition(generateToken(sortQuery.query, { lineNumber: 1, column: 5 }))).toEqual(
        StatementPosition.SortField
      );
      expect(getStatementPosition(generateToken(sortQuery.query, { lineNumber: 1, column: 25 }))).toEqual(
        StatementPosition.SortField
      );
      expect(getStatementPosition(generateToken(sortQueryWithFunctions.query, { lineNumber: 1, column: 5 }))).toEqual(
        StatementPosition.SortField
      );
      expect(getStatementPosition(generateToken(sortQuery.query, { lineNumber: 1, column: 38 }))).toEqual(
        StatementPosition.SortField
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 6, column: 7 }))).toEqual(
        StatementPosition.SortField
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 6, column: 27 }))).toEqual(
        StatementPosition.SortField
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 7, column: 7 }))).toEqual(
        StatementPosition.SortField
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 6, column: 40 }))).toEqual(
        StatementPosition.SortField
      );
    });

    it('should return StatementPosition.SortFieldExpression after a field operator in a sort command', () => {
      expect(getStatementPosition(generateToken(sortQuery.query, { lineNumber: 1, column: 7 }))).toEqual(
        StatementPosition.SortFieldExpression
      );
      expect(getStatementPosition(generateToken(sortQuery.query, { lineNumber: 1, column: 27 }))).toEqual(
        StatementPosition.SortFieldExpression
      );
      expect(getStatementPosition(generateToken(sortQueryWithFunctions.query, { lineNumber: 1, column: 7 }))).toEqual(
        StatementPosition.SortFieldExpression
      );
      expect(getStatementPosition(generateToken(sortQueryWithFunctions.query, { lineNumber: 1, column: 12 }))).toEqual(
        StatementPosition.SortFieldExpression
      );
      // mulltiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 6, column: 9 }))).toEqual(
        StatementPosition.SortFieldExpression
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 6, column: 29 }))).toEqual(
        StatementPosition.SortFieldExpression
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 7, column: 9 }))).toEqual(
        StatementPosition.SortFieldExpression
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 7, column: 14 }))).toEqual(
        StatementPosition.SortFieldExpression
      );
    });
  });

  describe('DEDUP command', () => {
    it('should return StatementPosition.AfterDedupFieldNames after dedup command fields', () => {
      expect(
        getStatementPosition(generateToken(dedupQueryWithOptionalArgs.query, { lineNumber: 1, column: 43 }))
      ).toEqual(StatementPosition.AfterDedupFieldNames);
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 8, column: 45 }))).toEqual(
        StatementPosition.AfterDedupFieldNames
      );
    });

    it('should return StatementPosition.FieldList after dedup command', () => {
      expect(
        getStatementPosition(generateToken(dedupQueryWithOptionalArgs.query, { lineNumber: 1, column: 6 }))
      ).toEqual(StatementPosition.FieldList);
      expect(
        getStatementPosition(generateToken(dedupQueryWithOptionalArgs.query, { lineNumber: 1, column: 8 }))
      ).toEqual(StatementPosition.FieldList);
      expect(
        getStatementPosition(generateToken(dedupQueryWithOptionalArgs.query, { lineNumber: 1, column: 19 }))
      ).toEqual(StatementPosition.FieldList);
      expect(
        getStatementPosition(generateToken(dedupQueryWithOptionalArgs.query, { lineNumber: 1, column: 34 }))
      ).toEqual(StatementPosition.FieldList);
      expect(
        getStatementPosition(generateToken(dedupQueryWithoutOptionalArgs.query, { lineNumber: 1, column: 6 }))
      ).toEqual(StatementPosition.FieldList);
      expect(
        getStatementPosition(generateToken(dedupQueryWithoutOptionalArgs.query, { lineNumber: 1, column: 17 }))
      ).toEqual(StatementPosition.FieldList);
      expect(
        getStatementPosition(generateToken(dedupQueryWithoutOptionalArgs.query, { lineNumber: 1, column: 32 }))
      ).toEqual(StatementPosition.FieldList);

      // multilin
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 8, column: 8 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 8, column: 10 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 8, column: 21 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 8, column: 36 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 9, column: 8 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 9, column: 19 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 9, column: 34 }))).toEqual(
        StatementPosition.FieldList
      );
    });
  });
  describe('TOP command', () => {
    it('should return StatementPosition.AfterTopCommand after top by keyword', () => {
      expect(getStatementPosition(generateToken(topQuery.query, { lineNumber: 1, column: 4 }))).toEqual(
        StatementPosition.AfterTopCommand
      );
      expect(getStatementPosition(generateToken(topQuery.query, { lineNumber: 1, column: 8 }))).toEqual(
        StatementPosition.AfterTopCommand
      );
      expect(getStatementPosition(generateToken(topQuery.query, { lineNumber: 1, column: 36 }))).toEqual(
        StatementPosition.AfterTopCommand
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 10, column: 38 }))).toEqual(
        StatementPosition.AfterTopCommand
      );
      expect(getStatementPosition(generateToken(topQuery.query, { lineNumber: 1, column: 8 }))).toEqual(
        StatementPosition.AfterTopCommand
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 10, column: 6 }))).toEqual(
        StatementPosition.AfterTopCommand
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 10, column: 10 }))).toEqual(
        StatementPosition.AfterTopCommand
      );
    });

    it('should return StatementPosition.FieldList after fields in top command', () => {
      expect(getStatementPosition(generateToken(topQuery.query, { lineNumber: 1, column: 23 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(topQuery.query, { lineNumber: 1, column: 44 }))).toEqual(
        StatementPosition.FieldList
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 10, column: 25 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 10, column: 46 }))).toEqual(
        StatementPosition.FieldList
      );
    });
  });
  describe('HEAD command', () => {
    it('should return StatementPosition.AfterHeadCommand after head', () => {
      expect(getStatementPosition(generateToken(headQuery.query, { lineNumber: 1, column: 5 }))).toEqual(
        StatementPosition.AfterHeadCommand
      );
      expect(getStatementPosition(generateToken(headQuery.query, { lineNumber: 1, column: 8 }))).toEqual(
        StatementPosition.AfterHeadCommand
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 11, column: 7 }))).toEqual(
        StatementPosition.AfterHeadCommand
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 11, column: 10 }))).toEqual(
        StatementPosition.AfterHeadCommand
      );
    });
  });
  describe('RARE command', () => {
    it('should return StatementPosition.AfterRareCommand after rare by', () => {
      expect(getStatementPosition(generateToken(rareQuery.query, { lineNumber: 1, column: 5 }))).toEqual(
        StatementPosition.AfterRareCommand
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 12, column: 7 }))).toEqual(
        StatementPosition.AfterRareCommand
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 12, column: 32 }))).toEqual(
        StatementPosition.AfterRareCommand
      );
    });

    it('should return StatementPosition.FieldList after rare fields', () => {
      expect(getStatementPosition(generateToken(rareQuery.query, { lineNumber: 1, column: 13 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(rareQuery.query, { lineNumber: 1, column: 38 }))).toEqual(
        StatementPosition.FieldList
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 12, column: 15 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 12, column: 40 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(rareQuery.query, { lineNumber: 1, column: 30 }))).toEqual(
        StatementPosition.AfterRareCommand
      );
    });
  });
  describe('EVAL command', () => {
    it('should return StatementPosition.BeforeLogicalExpression after eval = operator', () => {
      expect(getStatementPosition(generateToken(evalQuery.query, { lineNumber: 1, column: 21 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
      expect(getStatementPosition(generateToken(evalQuery.query, { lineNumber: 1, column: 56 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
      expect(getStatementPosition(generateToken(evalQuery.query, { lineNumber: 1, column: 89 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 13, column: 23 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 13, column: 58 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 13, column: 91 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
    });

    it('should return StatementPosition.EvalClause after eval commas', () => {
      expect(getStatementPosition(generateToken(evalQuery.query, { lineNumber: 1, column: 5 }))).toEqual(
        StatementPosition.EvalClause
      );
      expect(getStatementPosition(generateToken(evalQuery.query, { lineNumber: 1, column: 39 }))).toEqual(
        StatementPosition.EvalClause
      );
      expect(getStatementPosition(generateToken(evalQuery.query, { lineNumber: 1, column: 70 }))).toEqual(
        StatementPosition.EvalClause
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 13, column: 7 }))).toEqual(
        StatementPosition.EvalClause
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 13, column: 41 }))).toEqual(
        StatementPosition.EvalClause
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 13, column: 72 }))).toEqual(
        StatementPosition.EvalClause
      );
    });

    it('should return StatementPosition.BeforeLogicalExpression after a logical expression operator in eval', () => {
      expect(getStatementPosition(generateToken(evalQuery.query, { lineNumber: 1, column: 65 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
      // multiline
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 13, column: 67 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 13, column: 102 }))).toEqual(
        StatementPosition.BeforeLogicalExpression
      );
    });
  });

  describe('PARSE command', () => {
    it('should return StatementPosition.Expression after PARSE command', () => {
      expect(getStatementPosition(generateToken(parseQuery.query, { lineNumber: 1, column: 6 }))).toEqual(
        StatementPosition.Expression
      );
      expect(getStatementPosition(generateToken(multiLineFullQuery.query, { lineNumber: 14, column: 8 }))).toEqual(
        StatementPosition.Expression
      );
    });
  });

  describe('JOIN command', () => {
    it('should return StatementPosition.AfterJoinCommand after JOIN command', () => {
      expect(getStatementPosition(generateToken(joinQuery.query, { lineNumber: 1, column: 16 }))).toEqual(
        StatementPosition.AfterJoinCommand
      );
      expect(getStatementPosition(generateToken(joinQuery.query, { lineNumber: 1, column: 30 }))).toEqual(
        StatementPosition.AfterJoinCommand
      );
    });
    it('should return StatementPosition.JoinCriteria after ON keyword', () => {
      expect(getStatementPosition(generateToken(joinQuery.query, { lineNumber: 1, column: 73 }))).toEqual(
        StatementPosition.JoinCriteria
      );
    });
  });

  describe('RENAME command', () => {
    it('should return StatementPosition.BeforeAsClause after an identifier', () => {
      expect(getStatementPosition(generateToken(renameQuery.query, { lineNumber: 1, column: 17 }))).toEqual(
        StatementPosition.BeforeAsClause
      );
      expect(getStatementPosition(generateToken(renameQuery.query, { lineNumber: 1, column: 37 }))).toEqual(
        StatementPosition.BeforeAsClause
      );
    });

    it('should return StatementPosition.FieldList after AS keyword', () => {
      expect(getStatementPosition(generateToken(renameQuery.query, { lineNumber: 1, column: 20 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(renameQuery.query, { lineNumber: 1, column: 40 }))).toEqual(
        StatementPosition.FieldList
      );
    });
  });

  describe('GROK command', () => {
    it('should return StatementPosition.FieldList after GROK command', () => {
      expect(getStatementPosition(generateToken(grokQuery.query, { lineNumber: 1, column: 5 }))).toEqual(
        StatementPosition.FieldList
      );
    });
  });

  describe('PATTERNS command', () => {
    it('should return StatementPosition.AfterPatternCommand', () => {
      expect(getStatementPosition(generateToken(patternsQuery.query, { lineNumber: 1, column: 9 }))).toEqual(
        StatementPosition.AfterPatternsCommand
      );
    });

    it('should return StatementPosition.Expression after identifier =', () => {
      expect(getStatementPosition(generateToken(patternsQuery.query, { lineNumber: 1, column: 16 }))).toEqual(
        StatementPosition.Expression
      );
    });

    it('should return StatementPosition.AfterStatsBy after by in patterns command', () => {
      expect(getStatementPosition(generateToken(patternsQuery.query, { lineNumber: 1, column: 41 }))).toEqual(
        StatementPosition.AfterStatsBy
      );
    });

    it('should return StatementPosition.AfterPatternsMethod after method in patterns command', () => {
      expect(getStatementPosition(generateToken(patternsQuery.query, { lineNumber: 1, column: 75 }))).toEqual(
        StatementPosition.AfterPatternMethod
      );
    });

    it('should return StatementPosition.AfterPatternsMode after mode in patterns command', () => {
      expect(getStatementPosition(generateToken(patternsQuery.query, { lineNumber: 1, column: 54 }))).toEqual(
        StatementPosition.AfterPatternMode
      );
    });

    it('should return StatementPosition.Unknown after a literal in patterns command', () => {
      expect(getStatementPosition(generateToken(patternsQuery.query, { lineNumber: 1, column: 87 }))).toEqual(
        StatementPosition.Unknown
      );
      expect(getStatementPosition(generateToken(patternsQuery.query, { lineNumber: 1, column: 115 }))).toEqual(
        StatementPosition.Unknown
      );
    });

    it('should return StatementPosition.PatternsArguments', () => {
      expect(getStatementPosition(generateToken(patternsQuery.query, { lineNumber: 1, column: 47 }))).toEqual(
        StatementPosition.PatternsArguments
      );
      expect(getStatementPosition(generateToken(patternsQuery.query, { lineNumber: 1, column: 90 }))).toEqual(
        StatementPosition.PatternsArguments
      );
    });
  });

  describe('LOOKUP command', () => {
    it('should return StatementPosition.Unknown after LOOKUP command', () => {
      expect(getStatementPosition(generateToken(lookupQuery.query, { lineNumber: 1, column: 7 }))).toEqual(
        StatementPosition.Unknown
      );
    });
    it('should return StatementPosition.AfterLookupTableSource after a table identifier in LOOKUP command', () => {
      expect(getStatementPosition(generateToken(lookupQuery.query, { lineNumber: 1, column: 18 }))).toEqual(
        StatementPosition.AfterLookupTableSource
      );
    });
    it('should return StatementPosition.FieldList after LOOKUP keywords append, replace, as', () => {
      expect(getStatementPosition(generateToken(lookupQuery.query, { lineNumber: 1, column: 41 }))).toEqual(
        StatementPosition.FieldList
      );
      expect(getStatementPosition(generateToken(lookupQuery.query, { lineNumber: 1, column: 62 }))).toEqual(
        StatementPosition.FieldList
      );
    });
    it('should return StatementPosition.AfterLookupMappingList after LOOKUP identifiers', () => {
      expect(getStatementPosition(generateToken(lookupQuery.query, { lineNumber: 1, column: 34 }))).toEqual(
        StatementPosition.AfterLookupMappingList
      );
    });
  });
  describe('KMEANS command', () => {
    it('should return StatementPosition.AfterKmeansCommand after KMEANS command', () => {
      expect(getStatementPosition(generateToken(kmeansQuery.query, { lineNumber: 1, column: 7 }))).toEqual(
        StatementPosition.AfterKmeansCommand
      );
      expect(getStatementPosition(generateToken(kmeansQuery.query, { lineNumber: 1, column: 19 }))).toEqual(
        StatementPosition.AfterKmeansCommand
      );
    });
  });
  describe('AD command', () => {
    it('should return StatementPosition.AfterAdCommand after AD command', () => {
      expect(getStatementPosition(generateToken(adQuery.query, { lineNumber: 1, column: 3 }))).toEqual(
        StatementPosition.AfterAdCommand
      );
      expect(getStatementPosition(generateToken(adQuery.query, { lineNumber: 1, column: 18 }))).toEqual(
        StatementPosition.AfterAdCommand
      );
      expect(getStatementPosition(generateToken(adQuery.query, { lineNumber: 1, column: 34 }))).toEqual(
        StatementPosition.AfterAdCommand
      );
    });
    it('should return StatementPosition.Unknown after identifier in AD command', () => {
      expect(getStatementPosition(generateToken(adQuery.query, { lineNumber: 1, column: 30 }))).toEqual(
        StatementPosition.Unknown
      );
      expect(getStatementPosition(generateToken(adQuery.query, { lineNumber: 1, column: 47 }))).toEqual(
        StatementPosition.Unknown
      );
    });
  });
  describe('ML command', () => {
    it('should return StatementPosition.Unknown after ML command', () => {
      expect(getStatementPosition(generateToken(mlQuery.query, { lineNumber: 1, column: 3 }))).toEqual(
        StatementPosition.Unknown
      );
    });
  });
  describe('FILLNULL command', () => {
    it('should return StatementPosition.AfterFillNullCommand after FILLNULL command', () => {
      expect(getStatementPosition(generateToken(fillNullWithQuery.query, { lineNumber: 1, column: 9 }))).toEqual(
        StatementPosition.AfterFillNullCommand
      );
    });
    it('should return StatementPosition.FieldList after IN in FILLNULL command', () => {
      expect(getStatementPosition(generateToken(fillNullWithQuery.query, { lineNumber: 1, column: 33 }))).toEqual(
        StatementPosition.FieldList
      );
    });
    it('should return StatementPosition.AfterFillNullWith after WITH in FILLNULL command', () => {
      expect(getStatementPosition(generateToken(fillNullWithQuery.query, { lineNumber: 1, column: 14 }))).toEqual(
        StatementPosition.AfterFillNullWith
      );
    });
    it('should return StatementPosition.BeforeValueExpression after USING = in FILLNULL command', () => {
      expect(getStatementPosition(generateToken(fillNullUsingQuery.query, { lineNumber: 1, column: 24 }))).toEqual(
        StatementPosition.BeforeValueExpression
      );
      expect(getStatementPosition(generateToken(fillNullUsingQuery.query, { lineNumber: 1, column: 51 }))).toEqual(
        StatementPosition.BeforeValueExpression
      );
    });
    it('should return StatementPosition.BeforeFieldExpression in FILLNULL USING command', () => {
      expect(getStatementPosition(generateToken(fillNullUsingQuery.query, { lineNumber: 1, column: 15 }))).toEqual(
        StatementPosition.BeforeFieldExpression
      );
      expect(getStatementPosition(generateToken(fillNullUsingQuery.query, { lineNumber: 1, column: 31 }))).toEqual(
        StatementPosition.BeforeFieldExpression
      );
    });
  });

  describe('TRENDLINE command', () => {
    it('should return StatementPosition.AfterTrendlineCommand after TRENDLINE command', () => {
      expect(getStatementPosition(generateToken(trendlineQuery.query, { lineNumber: 1, column: 10 }))).toEqual(
        StatementPosition.AfterTrendlineCommand
      );
    });

    it('should return StatementPosition.SortField after sort in TRENDLINE command', () => {
      expect(getStatementPosition(generateToken(trendlineQuery.query, { lineNumber: 1, column: 16 }))).toEqual(
        StatementPosition.SortField
      );
    });

    it('should return StatementPosition.Field after sort operator in TRENDLINE command', () => {
      expect(getStatementPosition(generateToken(trendlineQuery.query, { lineNumber: 1, column: 16 }))).toEqual(
        StatementPosition.SortField
      );
    });
    it('should return StatementPosition.TrendlineClause after sort field in TRENDLINE command', () => {
      expect(getStatementPosition(generateToken(trendlineQuery.query, { lineNumber: 1, column: 26 }))).toEqual(
        StatementPosition.TrendlineClause
      );
    });

    it('should return StatementPosition.BeforeFieldExpression after numberOfDataPoints in TRENDLINE command', () => {
      expect(getStatementPosition(generateToken(trendlineQuery.query, { lineNumber: 1, column: 33 }))).toEqual(
        StatementPosition.BeforeFieldExpression
      );
    });
  });
});

describe('APPENDCOL command', () => {
  it('should return StatementPosition.AfterAppendColCommand after APPENDCOL command', () => {
    expect(getStatementPosition(generateToken(appendColQuery.query, { lineNumber: 1, column: 10 }))).toEqual(
      StatementPosition.AfterAppendColCommand
    );
  });

  it('should return StatementPosition.NewCommand in APPENDCOL subcommand', () => {
    expect(getStatementPosition(generateToken(appendColQuery.query, { lineNumber: 1, column: 25 }))).toEqual(
      StatementPosition.NewCommand
    );
  });
});

describe('EXPAND command', () => {
  it('should return StatementPosition.BeforeFieldExpression after EXPAND command', () => {
    expect(getStatementPosition(generateToken(expandQuery.query, { lineNumber: 1, column: 7 }))).toEqual(
      StatementPosition.BeforeFieldExpression
    );
  });
});
describe('FLATTEN command', () => {
  it('should return StatementPosition.BeforeFieldExpression after FLATTEN command', () => {
    expect(getStatementPosition(generateToken(flattenQuery.query, { lineNumber: 1, column: 8 }))).toEqual(
      StatementPosition.BeforeFieldExpression
    );
    expect(getStatementPosition(generateToken(flattenQuery.query, { lineNumber: 1, column: 26 }))).toEqual(
      StatementPosition.BeforeFieldExpression
    );
  });
  describe('REVERSE command', () => {
    it('should return StatementPosition.Unknown after REVERSE command', () => {
      expect(getStatementPosition(generateToken(reverseQuery.query, { lineNumber: 1, column: 8 }))).toEqual(
        StatementPosition.Unknown
      );
    });
  });
});
