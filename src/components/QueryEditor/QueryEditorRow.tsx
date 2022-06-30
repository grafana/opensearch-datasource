import { GrafanaTheme } from '@grafana/data';
import { IconButton, InlineFieldRow, InlineLabel, stylesFactory, useTheme, InlineSegmentGroup } from '@grafana/ui';
import { css } from '@emotion/css';
import { noop } from 'lodash';
import React, { PropsWithChildren } from 'react';

interface Props {
  label: string;
  onRemoveClick?: false | (() => void);
  onHideClick?: false | (() => void);
  hidden?: boolean;
  disableRemove?: boolean;
}

export const QueryEditorRow = ({
  children,
  label,
  onRemoveClick,
  onHideClick,
  hidden = false,
  disableRemove = false,
}: PropsWithChildren<Props>) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <InlineFieldRow>
      <InlineSegmentGroup>
        <InlineLabel width={17} as="div">
          <span>{label}</span>
          <span className={styles.iconWrapper}>
            {onHideClick && (
              <IconButton
                name={hidden ? 'eye-slash' : 'eye'}
                onClick={onHideClick}
                size="sm"
                aria-pressed={hidden}
                aria-label="hide metric"
                className={styles.icon}
              />
            )}
            {onRemoveClick && (
              <IconButton
                name="trash-alt"
                size="sm"
                className={styles.icon}
                onClick={onRemoveClick || noop}
                disabled={disableRemove}
                aria-label="remove metric"
              />
            )}
          </span>
        </InlineLabel>
      </InlineSegmentGroup>
      {children}
    </InlineFieldRow>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    iconWrapper: css`
      display: flex;
    `,
    icon: css`
      color: ${theme.colors.textWeak};
      margin-left: ${theme.spacing.xxs};
    `,
  };
});
