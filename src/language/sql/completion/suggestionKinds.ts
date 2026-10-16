import { StatementPosition, SuggestionKind } from '../../monarch/types';

export function getSQLSuggestionKinds(statementPosition: StatementPosition): SuggestionKind[] {
  switch (statementPosition) {
    case StatementPosition.SQLStartOfQuery:
      return [SuggestionKind.SQLKeyword, SuggestionKind.SQLIndexName];
    case StatementPosition.SQLAfterSelect:
      return [SuggestionKind.SQLFieldOrFunction];
    case StatementPosition.SQLAfterFromClause:
      return [SuggestionKind.SQLIndexName, SuggestionKind.SQLKeyword];
    case StatementPosition.SQLAfterFromClauseComplete:
      return [SuggestionKind.SQLKeyword];
    case StatementPosition.SQLAfterWhereClause:
      return [SuggestionKind.SQLField, SuggestionKind.SQLFieldOrFunction, SuggestionKind.SQLKeyword];
    case StatementPosition.SQLAfterComparisonOperator:
      return [SuggestionKind.SQLFieldValue];
    case StatementPosition.SQLAfterByClause:
      return [SuggestionKind.SQLFieldOrFunction];
    case StatementPosition.SQLExpression:
    default:
      return [SuggestionKind.SQLFieldOrFunction, SuggestionKind.SQLKeyword];
  }
}
