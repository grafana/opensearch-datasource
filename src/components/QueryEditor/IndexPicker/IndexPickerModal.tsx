import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Modal, useStyles2 } from '@grafana/ui';
import { OpenSearchIndex } from '../../../types';

interface IndexPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (index: string) => void;
  currentIndex: string;
  indices: OpenSearchIndex[];
  loading: boolean;
  onFetchIndices: () => void;
}

function matchesFilter(indexName: string, filter: string): boolean {
  if (!filter) {
    return true;
  }

  // Regex mode: /pattern/
  if (filter.startsWith('/') && filter.endsWith('/') && filter.length > 2) {
    try {
      return new RegExp(filter.slice(1, -1), 'i').test(indexName);
    } catch {
      return false;
    }
  }

  // Wildcard mode: contains * or ?
  if (filter.includes('*') || filter.includes('?')) {
    try {
      // escape regex special chars so they're treated as literals, then convert * to .* and ? to . for wildcard matching
      const pattern = filter
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      return new RegExp(`^${pattern}$`, 'i').test(indexName);
    } catch {
      return false;
    }
  }

  // Default: substring match
  return indexName.toLowerCase().includes(filter.toLowerCase());
}

export const IndexPickerModal = ({
  isOpen,
  onClose,
  onSelect,
  currentIndex,
  indices,
  loading,
  onFetchIndices,
}: IndexPickerModalProps) => {
  const styles = useStyles2(getStyles);
  const [searchFilter, setSearchFilter] = useState('');
  const [pendingIndex, setPendingIndex] = useState('');

  useEffect(() => {
    if (isOpen) {
      onFetchIndices();
    }
  }, [isOpen, onFetchIndices]);

  useEffect(() => {
    if (isOpen) {
      setPendingIndex(currentIndex);
      setSearchFilter('');
    }
  }, [isOpen, currentIndex]);

  if (!isOpen) {
    return null;
  }

  const filteredIndices = indices.filter((idx) => matchesFilter(idx.index, searchFilter));

  const handleConfirm = () => {
    onSelect(pendingIndex);
    onClose();
  };

  const selectionCount = pendingIndex ? 1 : 0;

  return (
    <Modal isOpen={isOpen} title="Select index" onDismiss={onClose}>
      <div className={styles.searchContainer}>
        <div className={styles.searchInputWrapper}>
          <Icon name="search" className={styles.searchIcon} />
          <input
            data-testid="index-picker-search"
            aria-label="Search indices"
            className={styles.searchInput}
            placeholder="Search, use * for wildcards or /regex/"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.currentTarget.value)}
          />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading && <div className={styles.statusMessage}>Loading...</div>}

        {!loading && filteredIndices.length === 0 && <div className={styles.statusMessage}>No indices found</div>}

        {!loading && filteredIndices.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.radioCol}></th>
                <th>Index</th>
                <th>Docs Count</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {filteredIndices.map((idx) => (
                <tr
                  key={idx.index}
                  data-testid={`index-row-${idx.index}`}
                  className={styles.row}
                  onClick={() => setPendingIndex(idx.index)}
                >
                  <td className={styles.radioCol}>
                    <input
                      type="radio"
                      name="index-selection"
                      aria-label={idx.index}
                      checked={pendingIndex === idx.index}
                      onChange={() => setPendingIndex(idx.index)}
                    />
                  </td>
                  <td>{idx.index}</td>
                  <td>{idx['docs.count'] ?? '-'}</td>
                  <td>
                    <span className={styles.healthDot(idx.health)} />
                    {idx.health}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.counter}>{selectionCount === 1 ? '1 index selected' : '0 indices selected'}</span>
        <div className={styles.footerButtons}>
          <Button variant="secondary" data-testid="modal-cancel" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" data-testid="modal-select" disabled={!pendingIndex} onClick={handleConfirm}>
            Select
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  searchContainer: css({
    marginBottom: theme.spacing(2),
  }),
  searchInputWrapper: css({
    display: 'flex',
    alignItems: 'center',
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.components.input.background,
    padding: theme.spacing(0, 1),
    '&:focus-within': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: -1,
    },
  }),
  searchIcon: css({
    color: theme.colors.text.secondary,
    marginRight: theme.spacing(0.5),
  }),
  searchInput: css({
    flex: 1,
    border: 'none',
    background: 'transparent',
    outline: 'none',
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
    padding: theme.spacing(1, 0),
    '&::placeholder': {
      color: theme.colors.text.disabled,
    },
  }),
  tableContainer: css({
    maxHeight: '40vh',
    overflowY: 'auto',
    marginBottom: theme.spacing(2),
  }),
  statusMessage: css({
    padding: theme.spacing(2),
    textAlign: 'center',
    color: theme.colors.text.secondary,
  }),
  table: css({
    width: '100%',
    borderCollapse: 'collapse',
    '& th': {
      textAlign: 'left',
      padding: theme.spacing(1),
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    },
    '& td': {
      padding: theme.spacing(1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
  }),
  radioCol: css({
    width: theme.spacing(4),
  }),
  row: css({
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  healthDot: (health: string) => {
    const colorMap: Record<string, string> = {
      green: theme.colors.success.main,
      yellow: theme.colors.warning.main,
      red: theme.colors.error.main,
    };
    return css({
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: colorMap[health] || theme.colors.text.disabled,
      marginRight: theme.spacing(0.5),
    });
  },
  footer: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  counter: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  footerButtons: css({
    display: 'flex',
    gap: theme.spacing(1),
  }),
});
