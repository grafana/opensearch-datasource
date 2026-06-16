import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

export const HelpMessage = () => {
  const styles = useStyles2(getStyles);

  return (
    <div data-testid="help-message" className={styles}>
      <div>
        <li> Table and Logs return any set of columns</li>
        <li>
          Time series returns
          <ul>
            <li>date, datetime, or timestamp datatype as time column</li>
            <li>numeric datatype as values</li>
          </ul>
        </li>
        <br />
        Example PPL query for time series:
        <br />
        <code>
          source=&lt;index&gt;
          <br />
          | eval dateValue=timestamp(timestamp)
          <br />| stats count(response) by dateValue
        </code>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) =>
  css({
    ul: {
      paddingLeft: theme.spacing(1.5),
    },
    code: {
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
    },
  });
