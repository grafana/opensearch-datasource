import { Monaco, monacoTypes } from '@grafana/ui';

import { CompletionItemProvider } from '../../monarch/CompletionItemProvider';
import { LinkedToken } from '../../monarch/LinkedToken';
import { TRIGGER_SUGGEST } from '../../monarch/commands';
import { CompletionItem, CompletionItemPriority, StatementPosition, SuggestionKind } from '../../monarch/types';
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
  LEFT_HINT,
  RIGHT_HINT,
  LEFT,
  RIGHT,
  ON,
  AS,
  PATTERN,
  PATTERNS_PARAMETERS,
  BY,
  PATTERN_METHODS,
  PATTERN_MODES,
  APPEND,
  REPLACE,
  KMEANS_PARAMETERS,
  AD_PARAMETERS,
  FILLNULL_PARAMETERS,
  TRENDLINE_TYPE,
  SORT,
  OVERRIDE,
  JOIN_METHODS,
  JOIN,
} from '../language';

import { getStatementPosition } from './statementPosition';
import { getSuggestionKinds } from './suggestionKinds';
import { getSourceIndexFromTokens } from './sourceIndex';
import { PPLTokenTypes } from '../tokenTypes';
import { MetricFindValue } from '@grafana/data';
import { OpenSearchIndex } from 'types';

export class PPLCompletionItemProvider extends CompletionItemProvider {
  getFields: (index?: string) => Promise<MetricFindValue[]>;
  getIndices: () => Promise<OpenSearchIndex[]>;
  getTerms: (field: string, index?: string) => Promise<MetricFindValue[]>;

  constructor(
    getFields: (index?: string) => Promise<MetricFindValue[]>,
    getIndices: () => Promise<OpenSearchIndex[]> = () => Promise.resolve([]),
    getTerms: (field: string, index?: string) => Promise<MetricFindValue[]> = () => Promise.resolve([])
  ) {
    super();
    this.getFields = getFields;
    this.getIndices = getIndices;
    this.getTerms = getTerms;
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
              sortText: CompletionItemPriority.High,
            });
          });
          break;
        case SuggestionKind.IndexName:
          await this.addIndexSuggestions(addSuggestion, monaco);
          break;
        case SuggestionKind.FieldValue:
          await this.addFieldValueSuggestions(addSuggestion, monaco, currentToken);
          break;
        case SuggestionKind.Pipe:
          addSuggestion('|', {
            insertText: '| $0',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Operator,
            command: TRIGGER_SUGGEST,
            sortText: CompletionItemPriority.High,
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
          break;
        case SuggestionKind.JoinCriteria:
          addSuggestion(ON, {
            insertText: `${ON} $0`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
          });
          break;
        case SuggestionKind.JoinCommand:
          addSuggestion(JOIN, {
            insertText: `${JOIN} $0`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Method,
            command: TRIGGER_SUGGEST,
          });
          break;
        case SuggestionKind.JoinMethods:
          JOIN_METHODS.forEach((method) => {
            addSuggestion(method, {
              insertText: `${method} $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Keyword,
              command: TRIGGER_SUGGEST,
            });
          });
          break;
        case SuggestionKind.SideAlias:
          [LEFT, RIGHT].forEach((alias) => {
            addSuggestion(alias, {
              insertText: `${alias} = $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Keyword,
              command: TRIGGER_SUGGEST,
            });
          });
        case SuggestionKind.JoinHintList:
          [LEFT_HINT, RIGHT_HINT].forEach((hint) => {
            addSuggestion(hint, {
              insertText: `${hint}.$0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Keyword,
              command: TRIGGER_SUGGEST,
            });
          });
          break;
        case SuggestionKind.AsKeyword:
          addSuggestion(AS, {
            insertText: `${AS} $0`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
          });
          break;
        case SuggestionKind.PatternsParameter:
          PATTERNS_PARAMETERS.forEach((parameter) => {
            if (parameter === PATTERN) {
              addSuggestion(parameter, {
                insertText: `(${parameter} = $0)`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                kind: monaco.languages.CompletionItemKind.Property,
                command: TRIGGER_SUGGEST,
              });
            } else {
              addSuggestion(parameter, {
                insertText: `${parameter} = $0`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                kind: monaco.languages.CompletionItemKind.Property,
                command: TRIGGER_SUGGEST,
              });
            }
          });
          break;
        case SuggestionKind.ByKeyword:
          addSuggestion(BY, {
            insertText: `${BY} $0`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
          });
          break;
        case SuggestionKind.PatternMethods:
          PATTERN_METHODS.forEach((method) => {
            addSuggestion(method, {
              insertText: `${method} $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Property,
              command: TRIGGER_SUGGEST,
            });
          });
          break;
        case SuggestionKind.PatternModes:
          PATTERN_MODES.forEach((mode) => {
            addSuggestion(mode, {
              insertText: `${mode} $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Property,
              command: TRIGGER_SUGGEST,
            });
          });
          break;
        case SuggestionKind.LookupArgument:
          [APPEND, REPLACE].forEach((argument) => {
            addSuggestion(argument, {
              insertText: `${argument} $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Keyword,
              command: TRIGGER_SUGGEST,
            });
          });
          break;
        case SuggestionKind.KmeansParameter:
          KMEANS_PARAMETERS.forEach((parameter) => {
            addSuggestion(parameter, {
              insertText: `${parameter} = $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Keyword,
              command: TRIGGER_SUGGEST,
            });
          });
          break;
        case SuggestionKind.AdParameter:
          AD_PARAMETERS.forEach((parameter) => {
            addSuggestion(parameter, {
              insertText: `${parameter} = $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Keyword,
              command: TRIGGER_SUGGEST,
            });
          });
          break;
        case SuggestionKind.FillNullParameter:
          FILLNULL_PARAMETERS.forEach((parameter) => {
            addSuggestion(parameter, {
              insertText: `${parameter} $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Keyword,
              command: TRIGGER_SUGGEST,
            });
          });
          break;
        case SuggestionKind.TrendlineType:
          TRENDLINE_TYPE.forEach((type) => {
            addSuggestion(type, {
              insertText: `${type} ($0)`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Property,
              command: TRIGGER_SUGGEST,
            });
          });
          break;
        case SuggestionKind.SortCommand:
          addSuggestion(SORT, {
            insertText: `${SORT} $0`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
          });
          break;
        case SuggestionKind.Override:
          addSuggestion(OVERRIDE, {
            insertText: `${OVERRIDE} = $0`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Property,
            command: TRIGGER_SUGGEST,
          });
          break;
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
      const sourceIndex = getSourceIndexFromTokens(currentToken ?? null);
      let fields = await this.getFields(sourceIndex);
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

  private async addIndexSuggestions(
    addSuggestion: (value: string, rest?: Partial<CompletionItem>) => void,
    monaco: typeof monacoTypes
  ): Promise<void> {
    try {
      const indices = await this.getIndices();
      indices.forEach((idx) => {
        if (idx.index) {
          addSuggestion(idx.index, {
            label: idx.index,
            insertText: idx.index,
            kind: monaco.languages.CompletionItemKind.Enum,
            sortText: CompletionItemPriority.High,
          });
        }
      });
    } catch {
      return;
    }
  }

  private async addFieldValueSuggestions(
    addSuggestion: (value: string, rest?: Partial<CompletionItem>) => void,
    monaco: typeof monacoTypes,
    currentToken?: LinkedToken | null
  ): Promise<void> {
    const comparisonToken = currentToken?.getPreviousNonWhiteSpaceToken();
    const fieldToken = comparisonToken?.getPreviousNonWhiteSpaceToken();
    const fieldName = fieldToken?.isIdentifier() || fieldToken?.is(PPLTokenTypes.Backtick) ? fieldToken.value : null;
    if (!fieldName) {
      return;
    }
    // Strip backticks from field names like `@message`
    const normalizedField = fieldName.replace(/^`|`$/g, '');

    try {
      const sourceIndex = getSourceIndexFromTokens(currentToken ?? null);
      const terms = await this.getTerms(normalizedField, sourceIndex);
      terms.forEach((term) => {
        if (term.text !== undefined && term.text !== null) {
          const quoted = `'${String(term.text).replace(/'/g, "\\'")}'`;
          addSuggestion(quoted, {
            label: quoted,
            insertText: quoted,
            kind: monaco.languages.CompletionItemKind.Value,
            sortText: CompletionItemPriority.High,
          });
        }
      });
    } catch {
      return;
    }
  }
}
