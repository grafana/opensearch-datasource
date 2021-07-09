import React, { FunctionComponent } from 'react';

export const HelpMessage: FunctionComponent = () => (
  <div className="gf-form grafana-info-box">
    <div>
      <h5>Table</h5>
      <ul>
        <li>return any set of columns</li>
      </ul>
      <br />
      <h5>Logs</h5>
      <ul>
        <li>return any set of columns</li>
      </ul>
      <br />
      <h5>Time series</h5>
      <ul>
        <li>return column as date, datetime, or timestamp</li>
        <li>return column with numeric datatype as values</li>
      </ul>
      <br />
      Example PPL query for time series:
      <br />
      <code>source=&lt;index&gt; | eval dateValue=timestamp(timestamp) | stats count(response) by dateValue</code>
    </div>
  </div>
);
