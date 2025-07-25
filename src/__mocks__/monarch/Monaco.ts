import { monacoTypes } from '@grafana/ui';

import { Monaco } from '../../language/monarch/types';
import * as PPLMultilineQueries from '../ppl-test-data/multilineQueries';
import { newCommandQuery as PPLNewCommandQuery } from '../ppl-test-data/newCommandQuery';
import * as PPLSingleLineQueries from '../ppl-test-data/singleLineQueries';
import { OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID } from 'language/ppl/language';

// Stub for the Monaco instance.
const MonacoMock: Monaco = {
  editor: {
    tokenize: (value: string, languageId: string) => {
      if (languageId === OPENSEARCH_PPL_LANGUAGE_DEFINITION_ID) {
        const TestData = {
          [PPLNewCommandQuery.query]: PPLNewCommandQuery.tokens,
          [PPLSingleLineQueries.emptyQuery.query]: PPLSingleLineQueries.emptyQuery.tokens,
          [PPLSingleLineQueries.whitespaceOnlyQuery.query]: PPLSingleLineQueries.whitespaceOnlyQuery.tokens,
          [PPLSingleLineQueries.searchQuery.query]: PPLSingleLineQueries.searchQuery.tokens,
          [PPLSingleLineQueries.searchQueryWithIndexClause.query]:
            PPLSingleLineQueries.searchQueryWithIndexClause.tokens,
          [PPLMultilineQueries.multiLineFullQuery.query]: PPLMultilineQueries.multiLineFullQuery.tokens,
          [PPLMultilineQueries.multiLineNewCommandQuery.query]: PPLMultilineQueries.multiLineNewCommandQuery.tokens,
          [PPLSingleLineQueries.whereQuery.query]: PPLSingleLineQueries.whereQuery.tokens,
          [PPLSingleLineQueries.fieldsQuery.query]: PPLSingleLineQueries.fieldsQuery.tokens,
          [PPLSingleLineQueries.statsQuery.query]: PPLSingleLineQueries.statsQuery.tokens,
          [PPLSingleLineQueries.eventStatsQuery.query]: PPLSingleLineQueries.eventStatsQuery.tokens,
          [PPLSingleLineQueries.dedupQueryWithOptionalArgs.query]:
            PPLSingleLineQueries.dedupQueryWithOptionalArgs.tokens,
          [PPLSingleLineQueries.dedupQueryWithoutOptionalArgs.query]:
            PPLSingleLineQueries.dedupQueryWithoutOptionalArgs.tokens,
          [PPLSingleLineQueries.sortQuery.query]: PPLSingleLineQueries.sortQuery.tokens,
          [PPLSingleLineQueries.sortQueryWithFunctions.query]: PPLSingleLineQueries.sortQueryWithFunctions.tokens,
          [PPLSingleLineQueries.headQuery.query]: PPLSingleLineQueries.headQuery.tokens,
          [PPLSingleLineQueries.topQuery.query]: PPLSingleLineQueries.topQuery.tokens,
          [PPLSingleLineQueries.rareQuery.query]: PPLSingleLineQueries.rareQuery.tokens,
          [PPLSingleLineQueries.evalQuery.query]: PPLSingleLineQueries.evalQuery.tokens,
          [PPLSingleLineQueries.parseQuery.query]: PPLSingleLineQueries.parseQuery.tokens,
          [PPLSingleLineQueries.queryWithArithmeticOps.query]: PPLSingleLineQueries.queryWithArithmeticOps.tokens,
          [PPLSingleLineQueries.queryWithLogicalExpression.query]:
            PPLSingleLineQueries.queryWithLogicalExpression.tokens,
          [PPLSingleLineQueries.queryWithFieldList.query]: PPLSingleLineQueries.queryWithFieldList.tokens,
          [PPLSingleLineQueries.queryWithFunctionCalls.query]: PPLSingleLineQueries.queryWithFunctionCalls.tokens,
        };
        return TestData[value];
      }
      return [];
    },
  },
  Range: {
    containsPosition: (range: monacoTypes.IRange, position: monacoTypes.IPosition) => {
      return (
        position.lineNumber >= range.startLineNumber &&
        position.lineNumber <= range.endLineNumber &&
        position.column >= range.startColumn &&
        position.column <= range.endColumn
      );
    },
    fromPositions: (start: monacoTypes.IPosition, end?: monacoTypes.IPosition) => {
      return {} as unknown as monacoTypes.Range;
    },
  },
  languages: {
    CompletionItemInsertTextRule: {
      InsertAsSnippet: 4,
    },
    CompletionItemKind: {
      Function: 1,
    },
  },
};

export default MonacoMock;
