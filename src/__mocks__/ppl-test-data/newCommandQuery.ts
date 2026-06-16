import { monacoTypes } from '@grafana/ui';
import { OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID } from 'language/ppl/language';
import { PPLTokenTypes } from 'language/ppl/tokenTypes';

export const newCommandQuery = {
  query: `fields timestamp | `,
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Keyword, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 6, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 7, type: PPLTokenTypes.Identifier, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 16, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 17, type: PPLTokenTypes.Pipe, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 18, type: PPLTokenTypes.Whitespace, language: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID },
    ],
  ] as monacoTypes.Token[][],
};
