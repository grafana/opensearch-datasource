import { monacoTypes } from '@grafana/ui';

import { LanguageDefinition } from '../monarch/register';

export type CompletionItem = monacoTypes.languages.CompletionItem;

export interface TokenTypes {
  Parenthesis: string;
  Whitespace: string;
  Keyword: string;
  Delimiter: string;
  Operator: string;
  Identifier: string;
  Type: string;
  Function: string;
  Number: string;
  String: string;
  Variable: string;
  Comment: string;
  Regexp: string;
}

export enum StatementPosition {
  Unknown,
  //PPL
  NewCommand,
  FunctionArg,
  BeforeLogicalExpression,
  AfterArithmeticOperator,
  AfterINKeyword,
  SortField,
  AfterHeadCommand,
  AfterFieldsCommand,
  FieldList,
  AfterDedupFieldNames,
  AfterStatsCommand,
  StatsFunctionArgument,
  AfterStatsBy,
  AfterBooleanArgument,
  EvalClause,
  Expression,
  SortFieldExpression,
  AfterSearchCommand,
  AfterRareCommand,
  AfterTopCommand,
  AfterEventStatsCommand,
}

export enum SuggestionKind {
  // PPL
  BooleanFunction,
  LogicalExpression,
  ValueExpression,
  FieldOperators,
  Field,
  BooleanLiteral,
  DedupParameter,
  StatsParameter,
  BooleanArgument,
  StatsFunctions,
  SpanClause,
  SortFunctions,
  FromClause,
  Command,
  FromKeyword,
  LogicalOperators,
  InKeyword,
  TopRareParameters,
  TakeFunction,
  WindowFunctions,
}

export enum CompletionItemPriority {
  High = 'a',
  MediumHigh = 'd',
  Medium = 'g',
  MediumLow = 'k',
  Low = 'q',
}

export interface Editor {
  tokenize: (value: string, languageId: string) => monacoTypes.Token[][];
}

export interface Range {
  containsPosition: (range: monacoTypes.IRange, position: monacoTypes.IPosition) => boolean;
  fromPositions: (start: monacoTypes.IPosition, end?: monacoTypes.IPosition) => monacoTypes.Range;
}

export interface Languages {
  CompletionItemInsertTextRule: {
    InsertAsSnippet: 4;
  };
  CompletionItemKind: {
    Function: 1;
  };
}
export interface Monaco {
  editor: Editor;
  Range: Range;
  languages: Languages;
}

export interface Completeable {
  getCompletionProvider(
    monaco: Monaco,
    languageDefinition: LanguageDefinition
  ): monacoTypes.languages.CompletionItemProvider;
}
