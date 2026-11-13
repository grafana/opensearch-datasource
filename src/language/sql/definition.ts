import { LanguageDefinition } from 'language/monarch/register';
import { OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID } from './language';

const openSearchSQLLanguageDefinition: LanguageDefinition = {
  id: OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID,
  extensions: [],
  aliases: [],
  mimetypes: [],
  loader: () => import('./language'),
};
export default openSearchSQLLanguageDefinition;
