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

The OpenSearch data source supports Grafana's unified alerting system. You can create alert rules that query OpenSearch data and trigger notifications when specified conditions are met.

For more information about Grafana alerting, refer to the [Grafana alerting documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/).

## Before you begin

- [Configure the OpenSearch data source](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/configure/).
- Familiarize yourself with [Grafana alerting concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/).

## Supported query types

Alerting works with queries that return numeric data that can be evaluated against a threshold or condition. The following table describes alerting support for each query type:

| Query type           | Alerting support |
| -------------------- | ---------------- |
| Lucene - Metric      | Yes              |
| Lucene - Logs        | No               |
| Lucene - Raw Data    | No               |
| Lucene - Raw Document| No               |
| Lucene - Traces      | No               |
| PPL - Time series    | Yes              |
| PPL - Table          | Limited          |
| PPL - Logs           | No               |

{{< admonition type="note" >}}
Alert rules require queries that return numeric, time-series data. Log and trace query types don't produce data in a format suitable for alert evaluation.
{{< /admonition >}}

## Create an alert rule

To create an alert rule using OpenSearch data:

1. Navigate to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Select the OpenSearch data source.
1. Build a metric query that returns numeric data.
1. Define the alert condition, for example, when the average value exceeds a threshold.
1. Configure notification settings.
1. Click **Save rule and exit**.

For detailed instructions, refer to [Create alert rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).
