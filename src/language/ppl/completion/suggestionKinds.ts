import { StatementPosition, SuggestionKind } from '../../monarch/types';

export function getSuggestionKinds(statementPosition: StatementPosition): SuggestionKind[] {
  switch (statementPosition) {
    case StatementPosition.NewCommand:
      return [SuggestionKind.Command];
    case StatementPosition.AfterHeadCommand:
      return [SuggestionKind.FromKeyword];
    case StatementPosition.AfterEventStatsCommand:
      return [SuggestionKind.WindowFunctions];
    case StatementPosition.AfterStatsCommand:
      return [SuggestionKind.StatsParameter, SuggestionKind.StatsFunctions, SuggestionKind.TakeFunction];
    case StatementPosition.SortField:
      return [SuggestionKind.FieldOperators, SuggestionKind.Field, SuggestionKind.SortFunctions];
    case StatementPosition.EvalClause:
    case StatementPosition.StatsFunctionArgument:
      return [SuggestionKind.Field];
    case StatementPosition.AfterFieldsCommand:
      return [SuggestionKind.FieldOperators, SuggestionKind.Field];
    case StatementPosition.AfterRareCommand:
    case StatementPosition.AfterTopCommand:
      return [SuggestionKind.Field, SuggestionKind.TopRareParameters];
    case StatementPosition.FieldList:
      return [SuggestionKind.Field];
    case StatementPosition.AfterBooleanArgument:
      return [SuggestionKind.BooleanLiteral];
    case StatementPosition.AfterDedupFieldNames:
      return [SuggestionKind.DedupParameter];
    case StatementPosition.AfterStatsBy:
      return [SuggestionKind.Field, SuggestionKind.SpanClause];
    case StatementPosition.SortFieldExpression:
      return [SuggestionKind.Field, SuggestionKind.SortFunctions];
    case StatementPosition.FunctionArg:
    case StatementPosition.AfterArithmeticOperator:
    case StatementPosition.AfterINKeyword:
      return [SuggestionKind.ValueExpression];
    // logical expression can contain comparison expression, which can start with a value expression
    // so we always need to suggest valueExpression when SuggestionKind.LogicalExpression is present
    case StatementPosition.Expression:
    case StatementPosition.BeforeLogicalExpression:
      return [SuggestionKind.LogicalExpression, SuggestionKind.ValueExpression];
    // see note about logical expression above
    case StatementPosition.AfterSearchCommand:
      return [SuggestionKind.LogicalExpression, SuggestionKind.FromClause, SuggestionKind.ValueExpression];
  }

  return [];
}
