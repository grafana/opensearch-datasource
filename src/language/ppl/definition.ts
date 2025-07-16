import { LanguageDefinition } from '@grafana/plugin-ui';
import { OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID } from './language';

const openSearchPPLLanguageDefinition: LanguageDefinition = {
  id: OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID,
  extensions: [],
  aliases: [],
  mimetypes: [],
  loader: () => import('./language'),
};
export default openSearchPPLLanguageDefinition;
