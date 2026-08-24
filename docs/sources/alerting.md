---
aliases:
  - /docs/plugins/grafana-opensearch-datasource/alerting/
description: Set up Grafana alerting with the OpenSearch data source.
keywords:
  - grafana
  - opensearch
  - alerting
  - alerts
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: OpenSearch alerting
weight: 450
review_date: "2026-03-26"
---

# OpenSearch alerting

The OpenSearch data source supports Grafana's unified alerting system. You can create alert rules that query OpenSearch data and trigger notifications when specified conditions are met. Alert queries are executed on the Grafana server through the backend plugin, not in the browser.

For more information about Grafana alerting, refer to the [Grafana alerting documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/).

## Before you begin

- [Configure the OpenSearch data source](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/configure/).
- Familiarize yourself with [Grafana alerting concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/).

## Supported query types

Alerting works with queries that return numeric time-series data that can be evaluated against a threshold or condition. The following table describes alerting support for each query type:

| Query type           | Alerting support | Notes                                                                  |
| -------------------- | ---------------- | ---------------------------------------------------------------------- |
| Lucene - Metric      | Yes              | Use metric aggregations with a Date Histogram bucket aggregation.      |
| Lucene - Logs        | No               | Returns log data, not numeric time series.                             |
| Lucene - Raw Data    | No               | Returns raw documents, not numeric time series.                        |
| Lucene - Raw Document| No               | Returns raw document JSON, not numeric time series.                    |
| Lucene - Traces      | No               | Returns trace data, not numeric time series.                           |
| PPL - Time series    | Yes              | Requires exactly two columns: a time field and a numeric value field.  |
| PPL - Table          | Limited          | Returns table frames; may work for simple threshold conditions.        |
| PPL - Logs           | No               | Returns log data, not numeric time series.                             |

{{< admonition type="note" >}}
The default PPL format is **Table**. To use PPL queries with alerting, change the **Format** drop-down to **Time series** in the query editor.
{{< /admonition >}}

## Create an alert rule

To create an alert rule using OpenSearch data:

1. Navigate to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Select the OpenSearch data source.
1. Build a query that returns numeric time-series data (refer to the examples in the following section).
1. Define the alert condition, for example, when the average value exceeds a threshold.
1. Configure notification settings.
1. Click **Save rule and exit**.

For detailed instructions, refer to [Create alert rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Alert query examples

The following examples show queries that produce data compatible with alerting evaluation.

### Lucene metric query

To alert on the average value of a numeric field, create a Lucene **Metric** query:

1. Set **Lucene Query Type** to **Metric**.
1. Enter a Lucene query to filter documents, for example `status:[500 TO 599]`.
1. Select **Average** as the metric aggregation and choose a numeric field.
1. Set the bucket aggregation to **Date Histogram** with an appropriate interval.

This produces a time series of average values that can be evaluated against a threshold condition, for example "alert when average response time exceeds 2000ms."

### PPL time-series query

To alert using a PPL query, set the **Format** to **Time series** and write a query that returns exactly two columns -- a timestamp and a numeric value:

```
source = my_index | eval dateValue = timestamp(timestamp) | stats count(response) by dateValue
```

This produces a time series of response counts that can be evaluated against a threshold condition, for example "alert when count exceeds 1000 per interval."

{{< admonition type="note" >}}
If the PPL query returns more or fewer than two columns, or if the value column isn't numeric, the query fails with an error such as "response should have 2 fields" or "found non-numerical value in value field."
{{< /admonition >}}
