import { getTemplateSrv, TemplateSrv } from '@grafana/runtime';
import type { Monaco, monacoTypes } from '@grafana/ui';

// import { ResourcesAPI } from '../../resources/ResourcesAPI';

import { LinkedToken } from './LinkedToken';
import { linkedTokenBuilder } from './linkedTokenBuilder';
import { LanguageDefinition } from './register';
import { Completeable, StatementPosition, SuggestionKind, TokenTypes } from './types';
import { OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID } from 'language/ppl/language';
import { PPLTokenTypes } from 'language/ppl/tokenTypes';

type CompletionItem = monacoTypes.languages.CompletionItem;

/*
CompletionItemProvider is an extendable class which needs to implement :
- tokenTypes
- getStatementPosition
- getSuggestionKinds
- getSuggestions
*/
export class CompletionItemProvider implements Completeable {
  templateSrv: TemplateSrv;
  tokenTypes: TokenTypes;

  constructor(templateSrv: TemplateSrv = getTemplateSrv()) {
    this.templateSrv = templateSrv;

    // implement with more specific tokens when extending this class
    this.tokenTypes = PPLTokenTypes;
  }

  // implemented by subclasses, given a token, returns a lexical position in a query
  getStatementPosition(currentToken: LinkedToken | null): StatementPosition {
    return StatementPosition.Unknown;
  }

  // implemented by subclasses, given a lexical statement position, returns potential kinds of suggestions
  getSuggestionKinds(position: StatementPosition): SuggestionKind[] {
    return [];
  }

  // implemented by subclasses, given potential suggestions kinds, returns suggestion objects for monaco aka "CompletionItem"
  getSuggestions(
    monaco: Monaco,
    currentToken: LinkedToken | null,
    suggestionKinds: SuggestionKind[],
    statementPosition: StatementPosition,
    position: monacoTypes.IPosition
  ): Promise<CompletionItem[]> {
    return Promise.reject([]);
  }

  // called by registerLanguage and passed to monaco with registerCompletionItemProvider
  // returns an object that implements https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItemProvider.html
  getCompletionProvider(monaco: Monaco, languageDefinition: LanguageDefinition) {
    const isPPL = languageDefinition.id === OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID; // backticks for field names in PPL
    const triggerCharacters = [' ', '$', ',', '(', "'"].concat(isPPL ? ['`'] : []);

    return {
      triggerCharacters, // one of these characters indicates that it is time to look for a suggestion
      provideCompletionItems: async (model: monacoTypes.editor.ITextModel, position: monacoTypes.IPosition) => {
        const currentToken = linkedTokenBuilder(monaco, languageDefinition, model, position, this.tokenTypes);
        const statementPosition = this.getStatementPosition(currentToken);
        const suggestionKinds = this.getSuggestionKinds(statementPosition);
        const suggestions = await this.getSuggestions(
          monaco,
          currentToken,
          suggestionKinds,
          statementPosition,
          position
        );

        return {
          suggestions,
        };
      },
    };
  }
}
