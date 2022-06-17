import { GrafanaTheme } from '@grafana/data';
import { Icon, stylesFactory, useTheme } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import React from 'react';
import { segmentStyles } from '../styles';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    icon: css`
      margin-right: ${theme.spacing.xs};
    `,
    button: css`
      justify-content: start;
    `,
  };
});

interface Props {
  label: string;
  open: boolean;
  onClick: () => void;
}

export const OpenCloseButton = ({ label, open, onClick }: Props) => {
  const styles = getStyles(useTheme());

  return (
    <button className={cx('gf-form-label', styles.button, segmentStyles)} onClick={onClick} aria-expanded={open}>
      <Icon name={open ? 'angle-down' : 'angle-right'} aria-hidden="true" className={styles.icon} />
      {label}
    </button>
  );
};
