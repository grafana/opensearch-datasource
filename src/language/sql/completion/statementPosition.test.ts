import { monacoTypes } from '@grafana/ui';

import {
  emptyQuery,
  fromCompleteQuery,
  fromQuery,
  groupByQuery,
  joinCompleteQuery,
  joinQuery,
  orderQuery,
  selectFunctionCallQuery,
  selectFunctionQuery,
  selectQuery,
  whitespaceOnlyQuery,
  whereEqualsQuery,
  whereQuery,
} from '../../../__mocks__/sql-test-data/singleLineQueries';
import MonacoMock from '../../../__mocks__/monarch/Monaco';
import TextModel from '../../../__mocks__/monarch/TextModel';
import { linkedTokenBuilder } from '../../monarch/linkedTokenBuilder';
import { StatementPosition } from '../../monarch/types';
import { SQLTokenTypes } from '../tokenTypes';

import { getSQLStatementPosition } from './statementPosition';
import openSearchSQLLanguageDefinition from '../definition';

function generateToken(query: string, position: monacoTypes.IPosition) {
  const testModel = TextModel(query);
  return linkedTokenBuilder(
    MonacoMock,
    openSearchSQLLanguageDefinition,
    testModel as monacoTypes.editor.ITextModel,
    position,
    SQLTokenTypes
  );
}

describe('getSQLStatementPosition', () => {
  it('should return StatementPosition.SQLStartOfQuery for an empty query', () => {
    expect(getSQLStatementPosition(generateToken(emptyQuery.query, { lineNumber: 1, column: 1 }))).toEqual(
      StatementPosition.SQLStartOfQuery
    );
  });

  it('should return StatementPosition.SQLStartOfQuery for a whitespace-only query', () => {
    expect(getSQLStatementPosition(generateToken(whitespaceOnlyQuery.query, { lineNumber: 1, column: 1 }))).toEqual(
      StatementPosition.SQLStartOfQuery
    );
  });

  describe('SELECT clause', () => {
    it('should return StatementPosition.SQLAfterSelect after the SELECT keyword', () => {
      expect(getSQLStatementPosition(generateToken(selectQuery.query, { lineNumber: 1, column: 7 }))).toEqual(
        StatementPosition.SQLAfterSelect
      );
    });

    it('should return StatementPosition.SQLAfterSelect after a function name', () => {
      expect(
        getSQLStatementPosition(generateToken(selectFunctionQuery.query, { lineNumber: 1, column: 13 }))
      ).toEqual(StatementPosition.SQLAfterSelect);
    });

    it('should return StatementPosition.SQLExpression inside function parentheses', () => {
      expect(
        getSQLStatementPosition(generateToken(selectFunctionCallQuery.query, { lineNumber: 1, column: 13 }))
      ).toEqual(StatementPosition.SQLExpression);
    });
  });

  describe('FROM clause', () => {
    it('should return StatementPosition.SQLAfterFromClause after FROM (no table yet)', () => {
      expect(getSQLStatementPosition(generateToken(fromQuery.query, { lineNumber: 1, column: 14 }))).toEqual(
        StatementPosition.SQLAfterFromClause
      );
    });

    it('should return StatementPosition.SQLAfterFromClauseComplete after a table name', () => {
      expect(
        getSQLStatementPosition(generateToken(fromCompleteQuery.query, { lineNumber: 1, column: 20 }))
      ).toEqual(StatementPosition.SQLAfterFromClauseComplete);
    });
  });

  describe('JOIN clause', () => {
    it('should return StatementPosition.SQLAfterFromClause after JOIN (no target yet)', () => {
      expect(getSQLStatementPosition(generateToken(joinQuery.query, { lineNumber: 1, column: 25 }))).toEqual(
        StatementPosition.SQLAfterFromClause
      );
    });

    it('should return StatementPosition.SQLAfterFromClauseComplete after a JOIN target', () => {
      expect(
        getSQLStatementPosition(generateToken(joinCompleteQuery.query, { lineNumber: 1, column: 31 }))
      ).toEqual(StatementPosition.SQLAfterFromClauseComplete);
    });
  });

  describe('WHERE clause', () => {
    it('should return StatementPosition.SQLAfterWhereClause after WHERE', () => {
      expect(getSQLStatementPosition(generateToken(whereQuery.query, { lineNumber: 1, column: 26 }))).toEqual(
        StatementPosition.SQLAfterWhereClause
      );
    });

    it('should return StatementPosition.SQLAfterComparisonOperator after =', () => {
      expect(
        getSQLStatementPosition(generateToken(whereEqualsQuery.query, { lineNumber: 1, column: 35 }))
      ).toEqual(StatementPosition.SQLAfterComparisonOperator);
    });
  });

  describe('GROUP BY / ORDER BY', () => {
    it('should return StatementPosition.SQLAfterByClause after GROUP BY', () => {
      expect(getSQLStatementPosition(generateToken(groupByQuery.query, { lineNumber: 1, column: 34 }))).toEqual(
        StatementPosition.SQLAfterByClause
      );
    });

    it('should return StatementPosition.SQLAfterByClause after ORDER', () => {
      expect(getSQLStatementPosition(generateToken(orderQuery.query, { lineNumber: 1, column: 31 }))).toEqual(
        StatementPosition.SQLAfterByClause
      );
    });
  });
});
