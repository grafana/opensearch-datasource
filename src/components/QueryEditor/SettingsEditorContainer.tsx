import { GrafanaTheme } from '@grafana/data';
import { Icon, stylesFactory, useTheme, InlineSegmentGroup } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import React, { ReactNode, useState } from 'react';
import { segmentStyles } from './styles';

const getStyles = stylesFactory((theme: GrafanaTheme, hidden: boolean) => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
    `,
    settingsWrapper: css`
      padding-top: ${theme.spacing.xs};
    `,
    icon: css`
      margin-right: ${theme.spacing.xs};
    `,
    button: css`
      justify-content: start;
      ${hidden &&
        css`
          color: ${theme.colors.textFaint};
        `}
    `,
  };
});
interface Props {
  label: string;
  hidden?: boolean;
  children: ReactNode;
}

export const SettingsEditorContainer = ({ label, children, hidden = false }: Props) => {
  const [open, setOpen] = useState(false);

  const styles = getStyles(useTheme(), hidden);

  return (
    <InlineSegmentGroup>
      <div className={cx(styles.wrapper)}>
        <button
          className={cx('gf-form-label query-part', styles.button, segmentStyles)}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <Icon name={open ? 'angle-down' : 'angle-right'} aria-hidden="true" className={styles.icon} />
          {label}
        </button>

        {open && <div className={styles.settingsWrapper}>{children}</div>}
      </div>
    </InlineSegmentGroup>
  );
};
