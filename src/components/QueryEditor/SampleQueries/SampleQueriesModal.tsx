import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Modal, useStyles2, Text } from '@grafana/ui';

import React from 'react';
import Prism from 'prismjs';
import { flattenTokens, pplTokenizer } from './utils';
import { sampleQueries } from './sampleQueries';
import { QueryType } from 'types';
import { trackSampleQueryClicked } from 'tracking';

type Props = {
  queryLanguage: QueryType;
  isOpen: boolean;
  onClose: () => void;
  onSelectSampleQuery: (query: string) => void;
};

export const SampleQueriesModal = (props: Props) => {
  const styles = useStyles2(getStyles);

  const onSampleSelect = (query: string) => {
    props.onSelectSampleQuery(query);
    trackSampleQueryClicked(props.queryLanguage);
    props.onClose();
  };

  return (
    <Modal isOpen={props.isOpen} title="Sample queries" onDismiss={props.onClose}>
      <Text>Get started by selecting a sample query. You can then edit it in the query field.</Text>
      {sampleQueries.map((item, i) => {
        return (
          <div key={i}>
            <Text variant="h6" weight="bold">
              {item.title}
            </Text>
            <button
              type="button"
              className={styles.cheatSheetExample}
              key={item.queryString}
              onClick={() => onSampleSelect(item.queryString)}
            >
              <pre data-testid={`sample-query-${i}`} className={styles.cheatSheetExampleCode}>
                {renderHighlightedMarkup(item.queryString, `item-${i}`)}
              </pre>
            </button>
          </div>
        );
      })}
    </Modal>
  );
};

function renderHighlightedMarkup(code: string, keyPrefix: string) {
  const grammar = pplTokenizer;
  const tokens = flattenTokens(Prism.tokenize(code, grammar));
  const spans = tokens
    .filter((token) => typeof token !== 'string')
    .map((token, i) => {
      return (
        <span
          className={`prism-token token ${token.types.join(' ')} ${token.aliases.join(' ')}`}
          key={`${keyPrefix}-token-${i}`}
        >
          {token.content}
        </span>
      );
    });

  return <div className="slate-query-field">{spans}</div>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  cheatSheetExample: css({
    margin: theme.spacing(0.5, 0, 2),
    // element is interactive, clear button styles
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    display: 'block',
  }),
  cheatSheetExampleCode: css({ margin: theme.spacing(0) }),
});
