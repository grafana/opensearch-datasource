import React, { useCallback, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, IconButton, useStyles2 } from '@grafana/ui';
import { EditorField } from '@grafana/plugin-ui';
import { useDatasource } from '../OpenSearchQueryContext';
import { OpenSearchIndex, OpenSearchQuery, QueryType } from '../../../types';
import { IndexPickerModal } from './IndexPickerModal';

interface Props {
  query: OpenSearchQuery;
  onChange: (query: OpenSearchQuery) => void;
}

function replaceOrSetPPLSource(queryString: string | undefined, newIndex: string): string {
  const trimmed = (queryString || '').trim();
  const sourceRegex = /^(source\s*=\s*)\S+/i; // matches "source = <index>" at the start, capturing the "source = " prefix
  if (sourceRegex.test(trimmed)) {
    return trimmed.replace(sourceRegex, `$1${newIndex}`); // replace the old index name in-place, preserving the rest of the query
  }
  if (trimmed.length === 0) {
    return `source = ${newIndex}`; // query is empty, start a fresh source clause
  }
  return `source = ${newIndex} | ${trimmed}`; // no source clause present, prepend one and pipe into the existing query
}

function getCurrentIndex(query: OpenSearchQuery, defaultIndex: string): string {
  if (query.queryType === QueryType.PPL) {
    const match = (query.query || '').trim().match(/^source\s*=\s*(\S+)/i); // extracts the index name from "source = <index>" at the start of the query
    return match ? match[1] : defaultIndex; // return the captured index name, or fall back to the datasource default
  }
  return query.index || defaultIndex;
}

export const IndexPicker = ({ query, onChange }: Props) => {
  const datasource = useDatasource();
  const styles = useStyles2(getStyles);
  const [indices, setIndices] = useState<OpenSearchIndex[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const currentIndex = getCurrentIndex(query, datasource.index);
  const isPPL = query.queryType === QueryType.PPL;

  const fetchIndices = useCallback(async () => {
    if (indices.length > 0) {
      return;
    }
    setLoading(true);
    try {
      const result = await datasource.getIndices();
      setIndices(result);
    } catch (e) {
      console.error('Failed to fetch indices', e);
    } finally {
      setLoading(false);
    }
  }, [indices.length, datasource]);

  const handleSelect = (newIndex: string) => {
    if (isPPL) {
      onChange({
        ...query,
        query: replaceOrSetPPLSource(query.query, newIndex),
        index: newIndex,
      });
    } else {
      onChange({ ...query, index: newIndex });
    }
  };

  const handleClear = () => {
    if (isPPL) {
      const defaultIndex = datasource.index || 'your_index';
      onChange({
        ...query,
        query: replaceOrSetPPLSource(query.query, defaultIndex),
        index: undefined,
      });
    } else {
      onChange({ ...query, index: undefined });
    }
  };

  return (
    <EditorField label="Index" htmlFor="index-picker">
      <div className={styles.container}>
        <Button variant="secondary" data-testid="index-picker-button" onClick={() => setIsModalOpen(true)}>
          Select index
        </Button>

        {query.index && (
          <span className={styles.pill} data-testid="index-picker-selected">
            {query.index}
            <IconButton
              name="times"
              aria-label="Clear index"
              data-testid="index-picker-clear"
              size="sm"
              onClick={handleClear}
            />
          </span>
        )}

        <IndexPickerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSelect={handleSelect}
          currentIndex={currentIndex}
          indices={indices}
          loading={loading}
          onFetchIndices={fetchIndices}
        />
      </div>
    </EditorField>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  pill: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.pill,
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
