import React from 'react';

export const HelpMessage = () => (
  <div data-testid="help-message" className="gf-form grafana-info-box">
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
