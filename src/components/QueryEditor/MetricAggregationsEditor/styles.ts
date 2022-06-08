import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { css } from 'emotion';

type PartialGrafanaTheme = Pick<GrafanaTheme, 'colors'>;

export const getStyles = stylesFactory((theme: PartialGrafanaTheme, hidden: boolean) => ({
  color:
    hidden &&
    css`
      &,
      &:hover,
      label,
      a {
        color: ${hidden ? theme.colors.textFaint : theme.colors.text};
      }
    `,
}));
