import { Monaco, monacoTypes } from '@grafana/ui';

import { CompletionItemProvider } from '../../monarch/CompletionItemProvider';
import { LinkedToken } from '../../monarch/LinkedToken';
import { TRIGGER_SUGGEST } from '../../monarch/commands';
import { CompletionItem, StatementPosition, SuggestionKind, CompletionItemPriority } from '../../monarch/types';
import { SQLTokenTypes } from '../tokenTypes';
import { SQL_KEYWORDS, SQL_FUNCTIONS } from '../language';
import { getSQLStatementPosition } from './statementPosition';
import { getSQLSuggestionKinds } from './suggestionKinds';
import { MetricFindValue } from '@grafana/data';
import { OpenSearchIndex } from 'types';

export class SQLCompletionItemProvider extends CompletionItemProvider {
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
    this.getStatementPosition = getSQLStatementPosition;
    this.getSuggestionKinds = getSQLSuggestionKinds;
    this.tokenTypes = SQLTokenTypes;
  }

  async getSuggestions(
    monaco: Monaco,
    currentToken: LinkedToken | null,
    suggestionKinds: SuggestionKind[],
    _: StatementPosition,
    position: monacoTypes.IPosition
  ): Promise<CompletionItem[]> {
    const suggestions: CompletionItem[] = [];
    const range =
      currentToken?.isWhiteSpace() || !currentToken?.range ? monaco.Range.fromPositions(position) : currentToken!.range;

    function addSuggestion(value: string, rest: Partial<CompletionItem> = {}) {
      suggestions.push({
        label: value,
        insertText: value,
        kind: monaco.languages.CompletionItemKind.Field,
        range,
        sortText: CompletionItemPriority.Medium,
        ...rest,
      });
    }

    for (const kind of suggestionKinds) {
      switch (kind) {
        case SuggestionKind.SQLKeyword:
          SQL_KEYWORDS.forEach((kw) =>
            addSuggestion(kw, {
              insertText: `${kw} $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Keyword,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.High,
            })
          );
          break;
        case SuggestionKind.SQLFunction:
          SQL_FUNCTIONS.forEach((fn) =>
            addSuggestion(fn, {
              insertText: `${fn}($0)`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Function,
              command: TRIGGER_SUGGEST,
            })
          );
          break;
        case SuggestionKind.SQLFieldOrFunction:
          SQL_FUNCTIONS.forEach((fn) =>
            addSuggestion(fn, {
              insertText: `${fn}($0)`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Function,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.High,
            })
          );
          await this.addFieldSuggestions(addSuggestion, monaco, range);
          break;
        case SuggestionKind.SQLField:
          await this.addFieldSuggestions(addSuggestion, monaco, range);
          break;
        case SuggestionKind.SQLIndexName:
          await this.addIndexSuggestions(addSuggestion, monaco);
          break;
        case SuggestionKind.SQLFieldValue:
          await this.addFieldValueSuggestions(addSuggestion, monaco, currentToken);
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
    range: monacoTypes.IRange | monacoTypes.languages.CompletionItemRanges
  ): Promise<void> {
    try {
      const fields = await this.getFields();
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
    currentToken: LinkedToken | null
  ): Promise<void> {
    const comparisonToken = currentToken?.getPreviousNonWhiteSpaceToken();
    if (!comparisonToken || comparisonToken.type !== this.tokenTypes.Operator || comparisonToken.value !== '=') {
      return;
    }

    // The values belong to the field on the left of the operator. Asking for the
    // terms of the empty field returns nothing, so the field has to be read from
    // the tokens that precede the operator.
    const fieldName = getFieldNameBeforeOperator(comparisonToken);
    if (!fieldName) {
      return;
    }

    try {
      const terms = await this.getTerms(fieldName);
      terms.forEach((term) => {
        if (term.text !== undefined && term.text !== null) {
          const quoted = `'${String(term.text).replace(/'/g, "''")}'`;
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

/**
 * Reads the name of the field that a comparison operator compares. The name may
 * be qualified with an alias or quoted with a backtick, and both of those are
 * stripped, because the terms of a field are asked for by its plain name.
 */
const getFieldNameBeforeOperator = (operatorToken: LinkedToken): string | undefined => {
  const fieldToken = operatorToken.getPreviousNonWhiteSpaceToken();
  if (!fieldToken) {
    return undefined;
  }

  // A token covers the whitespace that follows it as well, so the name is
  // trimmed before it is used.
  const name = (fieldToken.value ?? '').trim();
  const lastSegment = name.split('.').pop() ?? '';
  const unquoted = lastSegment.trim().replace(/^[`"]|[`"]$/g, '');
  return unquoted === '' ? undefined : unquoted;
};
