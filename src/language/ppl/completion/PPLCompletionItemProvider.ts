import { Monaco, monacoTypes } from '@grafana/ui';

// import { type ResourcesAPI } from '../../../resources/ResourcesAPI';
// import { LogGroup } from '../../../types';
import { CompletionItemProvider } from '../../monarch/CompletionItemProvider';
import { LinkedToken } from '../../monarch/LinkedToken';
import { TRIGGER_SUGGEST } from '../../monarch/commands';
import { CompletionItem, CompletionItemPriority, StatementPosition, SuggestionKind } from '../../monarch/types';
// import { fetchLogGroupFields } from '../../utils';
import {
  BOOLEAN_LITERALS,
  CONDITION_FUNCTIONS,
  DEDUP_PARAMETERS,
  EVAL_FUNCTIONS,
  FIELD_OPERATORS,
  IN,
  LOGICAL_EXPRESSION_OPERATORS,
  NOT,
  PPL_COMMANDS,
  SORT_FIELD_FUNCTIONS,
  SPAN,
  STATS_PARAMETERS,
  STATS_FUNCTIONS,
  FROM,
  COUNTFIELD,
  SHOWCOUNT,
  TAKE,
  INDEX,
  SOURCE,
  WINDOW_STATS_FUNCTIONS,
} from '../language';

import { getStatementPosition } from './statementPosition';
import { getSuggestionKinds } from './suggestionKinds';
import { PPLTokenTypes } from '../tokenTypes';
import { MetricFindValue } from '@grafana/data';

export class PPLCompletionItemProvider extends CompletionItemProvider {
  getFields: () => Promise<MetricFindValue[]>;

  constructor(getFields: () => Promise<MetricFindValue[]>) {
    super();
    this.getFields = getFields;
    this.getStatementPosition = getStatementPosition;
    this.getSuggestionKinds = getSuggestionKinds;
    this.tokenTypes = PPLTokenTypes;
  }

  async getSuggestions(
    monaco: Monaco,
    currentToken: LinkedToken | null,
    suggestionKinds: SuggestionKind[],
    _: StatementPosition,
    position: monacoTypes.IPosition
  ): Promise<CompletionItem[]> {
    const suggestions: CompletionItem[] = [];
    const invalidRangeToken =
      currentToken?.isWhiteSpace() || currentToken?.isParenthesis() || currentToken?.is(PPLTokenTypes.Backtick); // PPLTokenTypes.Backtick for field wrapping
    const range =
      invalidRangeToken || !currentToken?.range ? monaco.Range.fromPositions(position) : currentToken?.range;
    function toCompletionItem(value: string, rest: Partial<CompletionItem> = {}) {
      const item: monacoTypes.languages.CompletionItem = {
        label: value,
        insertText: value,
        kind: monaco.languages.CompletionItemKind.Field,
        range,
        sortText: CompletionItemPriority.Medium,
        ...rest,
      };
      return item;
    }

    function addSuggestion(value: string, rest: Partial<CompletionItem> = {}) {
      suggestions.push(toCompletionItem(value, rest));
    }

    for (const kind of suggestionKinds) {
      switch (kind) {
        case SuggestionKind.Command:
          PPL_COMMANDS.forEach((command) => {
            addSuggestion(command, {
              insertText: `${command} $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Method,
              command: TRIGGER_SUGGEST,
            });
          });
          break;
        case SuggestionKind.FromClause:
          [SOURCE, INDEX].forEach((keyword) => {
            addSuggestion(keyword, {
              insertText: `${keyword} = $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Keyword,
              command: TRIGGER_SUGGEST,
            });
          });
          break;
        case SuggestionKind.LogicalExpression:
          // booleanExpression
          CONDITION_FUNCTIONS.forEach((funct) => {
            addSuggestion(funct, {
              insertText: `${funct}($0)`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Function,
              command: TRIGGER_SUGGEST,
            });
          });
          addSuggestion(NOT, {
            insertText: `${NOT} $0`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Operator,
            command: TRIGGER_SUGGEST,
          });
          break;

        case SuggestionKind.ValueExpression:
          EVAL_FUNCTIONS.forEach((funct) => {
            addSuggestion(funct, {
              insertText: `${funct}($0)`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Function,
              command: TRIGGER_SUGGEST,
            });
          });
          await this.addFieldSuggestions(addSuggestion, monaco, range, currentToken);
          break;

        case SuggestionKind.FieldOperators:
          FIELD_OPERATORS.forEach((operator) => {
            addSuggestion(operator, {
              insertText: `${operator}$0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Operator,
              command: TRIGGER_SUGGEST,
            });
          });
          break;

        case SuggestionKind.BooleanLiteral:
          BOOLEAN_LITERALS.forEach((literal) =>
            addSuggestion(`= ${literal}`, {
              insertText: `= ${literal} $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Value,
              command: TRIGGER_SUGGEST,
            })
          );
          break;

        case SuggestionKind.DedupParameter:
          DEDUP_PARAMETERS.forEach((keyword) =>
            addSuggestion(keyword, {
              insertText: `${keyword} $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Property,
              command: TRIGGER_SUGGEST,
            })
          );
          break;

        case SuggestionKind.StatsParameter:
          STATS_PARAMETERS.forEach((keyword) => {
            addSuggestion(keyword, {
              insertText: `${keyword} $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Property,
              command: TRIGGER_SUGGEST,
            });
          });
          break;

        case SuggestionKind.StatsFunctions:
          STATS_FUNCTIONS.forEach((f) => {
            addSuggestion(f, {
              insertText: `${f}($0)`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Function,
              command: TRIGGER_SUGGEST,
            });
          });
          break;
        case SuggestionKind.WindowFunctions:
          WINDOW_STATS_FUNCTIONS.forEach((f) => {
            addSuggestion(f, {
              insertText: `${f}($0)`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Function,
              command: TRIGGER_SUGGEST,
            });
          });
          break;
          break;
        case SuggestionKind.TakeFunction:
          addSuggestion(TAKE, {
            insertText: `${TAKE}($0)`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Function,
            command: TRIGGER_SUGGEST,
          });
          break;

        case SuggestionKind.LogicalOperators:
          LOGICAL_EXPRESSION_OPERATORS.forEach((operator) => {
            addSuggestion(operator, {
              insertText: `${operator} $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Operator,
              command: TRIGGER_SUGGEST,
            });
          });
          break;

        case SuggestionKind.InKeyword:
          addSuggestion(IN, {
            insertText: `${IN} $0`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
          });
          break;

        case SuggestionKind.SpanClause:
          addSuggestion(SPAN, {
            insertText: `${SPAN}($0)`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Function,
            command: TRIGGER_SUGGEST,
          });
          break;

        case SuggestionKind.Field:
          await this.addFieldSuggestions(addSuggestion, monaco, range, currentToken);
          break;

        case SuggestionKind.FromKeyword:
          addSuggestion(FROM, {
            insertText: `${FROM} $0`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
          });
          break;

        case SuggestionKind.SortFunctions:
          SORT_FIELD_FUNCTIONS.forEach((funct) => {
            addSuggestion(funct, {
              insertText: `${funct}($0)`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Function,
              command: TRIGGER_SUGGEST,
            });
          });
          break;
        case SuggestionKind.TopRareParameters:
          [COUNTFIELD, SHOWCOUNT].forEach((parameter) => {
            addSuggestion(parameter, {
              insertText: `${parameter} =  $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Property,
              command: TRIGGER_SUGGEST,
            });
          });
      }
    }
    // always suggest template variables
    this.templateSrv.getVariables().map((v) => {
      const variable = `$${v.name}`;
      addSuggestion(variable, {
        range,
        label: variable,
        insertText: variable,
        kind: monaco.languages.CompletionItemKind.Variable,
        sortText: CompletionItemPriority.Low,
      });
    });

    return suggestions;
  }

  private async addFieldSuggestions(
    addSuggestion: (value: string, rest?: Partial<CompletionItem>) => void,
    monaco: typeof monacoTypes,
    range: monacoTypes.IRange | monacoTypes.languages.CompletionItemRanges,
    currentToken?: LinkedToken | null
  ): Promise<void> {
    try {
      let fields = await this.getFields();
      fields.forEach((field) => {
        if (field.text) {
          addSuggestion(field.text, {
            range,
            label: field.text,
            insertText: field.text,
            kind: monaco.languages.CompletionItemKind.Field,
            sortText: CompletionItemPriority.High,
          });
        }
      });
    } catch {
      return;
    }
  }
}
