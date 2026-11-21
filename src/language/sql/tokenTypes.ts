import { TokenTypes } from 'language/monarch/types';
import { OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID } from './language';

interface IsqlTokenTypes extends TokenTypes {
  Parenthesis: string;
  Whitespace: string;
  Identifier: string;
}

export const SQLTokenTypes: IsqlTokenTypes = {
  Parenthesis: `delimiter.parenthesis.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
  Whitespace: `white.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
  Keyword: `keyword.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
  Delimiter: `delimiter.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
  Operator: `operator.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
  Identifier: `identifier.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
  Type: `type.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
  Function: `predefined.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
  Number: `number.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
  String: `string.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
  Variable: `variable.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
  Comment: `comment.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
  Regexp: `regexp.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
};
