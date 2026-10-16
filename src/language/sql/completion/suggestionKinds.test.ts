import { StatementPosition, SuggestionKind } from '../../monarch/types';

import { getSQLSuggestionKinds } from './suggestionKinds';

describe('getSQLSuggestionKinds', () => {
  it('suggests keywords and index names at the start of a query', () => {
    expect(getSQLSuggestionKinds(StatementPosition.SQLStartOfQuery)).toEqual([
      SuggestionKind.SQLKeyword,
      SuggestionKind.SQLIndexName,
    ]);
  });

  it('suggests fields or functions after SELECT', () => {
    expect(getSQLSuggestionKinds(StatementPosition.SQLAfterSelect)).toEqual([SuggestionKind.SQLFieldOrFunction]);
  });

  it('suggests index names and keywords after FROM', () => {
    expect(getSQLSuggestionKinds(StatementPosition.SQLAfterFromClause)).toEqual([
      SuggestionKind.SQLIndexName,
      SuggestionKind.SQLKeyword,
    ]);
  });

  it('suggests keywords after a completed FROM clause', () => {
    expect(getSQLSuggestionKinds(StatementPosition.SQLAfterFromClauseComplete)).toEqual([SuggestionKind.SQLKeyword]);
  });

  it('suggests fields, functions and keywords after WHERE', () => {
    expect(getSQLSuggestionKinds(StatementPosition.SQLAfterWhereClause)).toEqual([
      SuggestionKind.SQLField,
      SuggestionKind.SQLFieldOrFunction,
      SuggestionKind.SQLKeyword,
    ]);
  });

  it('suggests field values after a comparison operator', () => {
    expect(getSQLSuggestionKinds(StatementPosition.SQLAfterComparisonOperator)).toEqual([SuggestionKind.SQLFieldValue]);
  });

  it('suggests fields or functions after GROUP BY / ORDER BY', () => {
    expect(getSQLSuggestionKinds(StatementPosition.SQLAfterByClause)).toEqual([SuggestionKind.SQLFieldOrFunction]);
  });

  it('suggests fields or functions in a general expression', () => {
    expect(getSQLSuggestionKinds(StatementPosition.SQLExpression)).toEqual([
      SuggestionKind.SQLFieldOrFunction,
      SuggestionKind.SQLKeyword,
    ]);
  });
});
