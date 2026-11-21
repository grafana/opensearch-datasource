import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { language, OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID } from './language';
import { SQLTokenTypes } from './tokenTypes';

/**
 * Tokenizes a query with the real monarch grammar, which is what the editor does.
 *
 * The grammar is registered under its own id, so Monaco appends the id as the
 * postfix of every token type. The completion code compares the token types it
 * reads back against `SQLTokenTypes`, so a postfix that does not match would
 * break completion without failing any other test.
 */
const tokenize = (query: string): string[] => {
  return monaco.editor
    .tokenize(query, OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID)
    .flat()
    .map((token) => token.type);
};

/** The token types of the parts of the query that are not whitespace. */
const tokenTypesOf = (query: string): string[] => {
  return tokenize(query).filter((type) => type !== SQLTokenTypes.Whitespace);
};

beforeAll(() => {
  monaco.languages.register({ id: OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID });
  monaco.languages.setMonarchTokensProvider(OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID, language);
});

describe('the SQL grammar', () => {
  it('names the language the completion code looks for', () => {
    // `SQLTokenTypes` is built from the id, and completion compares whole token
    // types, so the two have to agree.
    expect(SQLTokenTypes.Keyword).toBe(`keyword.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`);
  });

  it('tokenizes keywords', () => {
    expect(tokenize('SELECT')).toEqual([SQLTokenTypes.Keyword]);
    expect(tokenize('FROM')).toEqual([SQLTokenTypes.Keyword]);
    expect(tokenize('WHERE')).toEqual([SQLTokenTypes.Keyword]);
    expect(tokenize('GROUP BY level')).toEqual([
      SQLTokenTypes.Keyword,
      SQLTokenTypes.Whitespace,
      SQLTokenTypes.Keyword,
      SQLTokenTypes.Whitespace,
      SQLTokenTypes.Identifier,
    ]);
  });

  it('tokenizes functions as the predefined token type', () => {
    expect(tokenTypesOf('count(*)')).toEqual([
      SQLTokenTypes.Function,
      SQLTokenTypes.Parenthesis,
      SQLTokenTypes.Operator,
      SQLTokenTypes.Parenthesis,
    ]);
    expect(tokenTypesOf('date_trunc(ts)')[0]).toBe(SQLTokenTypes.Function);
    expect(tokenTypesOf('approx_distinct(service)')[0]).toBe(SQLTokenTypes.Function);
  });

  it('tokenizes identifiers', () => {
    expect(tokenize('service')).toEqual([SQLTokenTypes.Identifier]);
    expect(tokenize('e2e-logs')).toEqual([SQLTokenTypes.Identifier, SQLTokenTypes.Operator, SQLTokenTypes.Identifier]);
  });

  it('tokenizes a string literal', () => {
    // A double-quoted value is a string to the engine: `= "catalog"` matches rows.
    expect(tokenize("'error'")).toEqual([SQLTokenTypes.String]);
    expect(tokenize('"error"')).toEqual([SQLTokenTypes.String]);
    expect(tokenize("'it''s'")).toEqual([SQLTokenTypes.String]);
  });

  it('tokenizes a backtick identifier', () => {
    // The data source writes these itself when it quotes a time field, so an
    // unhighlighted backtick is visible in a query the user did not type.
    expect(tokenize('`@timestamp`')).toEqual([SQLTokenTypes.Identifier]);
    expect(tokenTypesOf('WHERE `@timestamp` >= 1')).toEqual([
      SQLTokenTypes.Keyword,
      SQLTokenTypes.Identifier,
      SQLTokenTypes.Operator,
      SQLTokenTypes.Number,
    ]);
  });

  it('tokenizes comments', () => {
    expect(tokenize('-- a comment')).toEqual([SQLTokenTypes.Comment]);
    expect(tokenize('# a comment')).toEqual([SQLTokenTypes.Comment]);
    // A block comment is three tokens: the text carries the comment token type,
    // the delimiters around it a `.quote` variant of it.
    expect(tokenize('/* a comment */')).toEqual([
      `comment.quote.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
      SQLTokenTypes.Comment,
      `comment.quote.${OPENSEARCH_SQL_LANGUAGE_DEFINITION_ID}`,
    ]);
  });

  it('tokenizes a template variable', () => {
    expect(tokenize('$service')).toEqual([SQLTokenTypes.Variable]);
    expect(tokenize('$my_service')[0]).toBe(SQLTokenTypes.Variable);
    expect(tokenize('${service:sqlstring}')).toEqual([SQLTokenTypes.Variable]);
  });

  it('tokenizes a whole query into the token types completion reads', () => {
    expect(tokenTypesOf("SELECT count(*) FROM idx WHERE service = 'catalog'")).toEqual([
      SQLTokenTypes.Keyword,
      SQLTokenTypes.Function,
      SQLTokenTypes.Parenthesis,
      SQLTokenTypes.Operator,
      SQLTokenTypes.Parenthesis,
      SQLTokenTypes.Keyword,
      SQLTokenTypes.Identifier,
      SQLTokenTypes.Keyword,
      SQLTokenTypes.Identifier,
      SQLTokenTypes.Operator,
      SQLTokenTypes.String,
    ]);
  });
});
