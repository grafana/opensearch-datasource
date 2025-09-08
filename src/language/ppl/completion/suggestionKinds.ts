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
    case StatementPosition.JoinCriteria:
      return [SuggestionKind.LogicalExpression, SuggestionKind.ValueExpression];
    case StatementPosition.AfterJoinMethods:
      return [SuggestionKind.JoinCommand];
    case StatementPosition.AfterJoinType:
      return [SuggestionKind.JoinMethods];
    // see note about logical expression above
    case StatementPosition.AfterSearchCommand:
      return [SuggestionKind.LogicalExpression, SuggestionKind.FromClause, SuggestionKind.ValueExpression];
    case StatementPosition.AfterJoinCommand:
      return [SuggestionKind.SideAlias, SuggestionKind.JoinHintList];
    case StatementPosition.BeforeAsClause:
      return [SuggestionKind.AsKeyword];
    case StatementPosition.AfterPatternsCommand:
      return [SuggestionKind.ByKeyword, SuggestionKind.PatternsParameter, SuggestionKind.Field];
    case StatementPosition.PatternsArguments:
      return [SuggestionKind.ByKeyword, SuggestionKind.PatternsParameter];
    case StatementPosition.AfterPatternMethod:
      return [SuggestionKind.PatternMethods];
    case StatementPosition.AfterPatternMode:
      return [SuggestionKind.PatternModes];
    case StatementPosition.AfterLookupTableSource:
      return [SuggestionKind.Field];
    case StatementPosition.AfterLookupMappingList:
      return [SuggestionKind.LookupArgument];
    case StatementPosition.AfterKmeansCommand:
      return [SuggestionKind.KmeansParameter];
    case StatementPosition.AfterAdCommand:
      return [SuggestionKind.AdParameter];
    case StatementPosition.AfterFillNullCommand:
      return [SuggestionKind.FillNullParameter];
    case StatementPosition.AfterFillNullWith:
      return [SuggestionKind.ValueExpression, SuggestionKind.InKeyword];
    case StatementPosition.BeforeValueExpression:
      return [SuggestionKind.ValueExpression];
    case StatementPosition.BeforeFieldExpression:
      return [SuggestionKind.Field];
    case StatementPosition.AfterTrendlineCommand:
      return [SuggestionKind.TrendlineType, SuggestionKind.SortCommand];
    case StatementPosition.TrendlineClause:
      return [SuggestionKind.TrendlineType];
    case StatementPosition.AfterAppendColCommand:
      return [SuggestionKind.Override];
  }

  return [];
}
