import { TokenTypes } from 'language/monarch/types';
import { OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID } from './language';

interface IpplTokenTypes extends TokenTypes {
  Pipe: string;
  Backtick: string;
  Command: string;
}

export const PPLTokenTypes: IpplTokenTypes = {
  Parenthesis: `delimiter.parenthesis.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Whitespace: `white.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Keyword: `keyword.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Command: `keyword.command.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Delimiter: `delimiter.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Pipe: `delimiter.pipe.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Operator: `operator.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Identifier: `identifier.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Type: `type.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Function: `predefined.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Number: `number.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  String: `string.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Variable: `variable.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Comment: `comment.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Regexp: `regexp.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Backtick: `string.backtick.${OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID}`,
};
