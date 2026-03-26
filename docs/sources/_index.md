---
aliases:
  - /docs/plugins/grafana-opensearch-datasource/
description: Use the OpenSearch data source to query and visualize logs, metrics, and traces from OpenSearch in Grafana.
keywords:
  - grafana
  - opensearch
  - data source
  - plugin
  - aws
  - amazon
  - logs
  - metrics
  - traces
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: OpenSearch
title: OpenSearch data source
weight: 1
review_date: "2026-03-26"
---

# OpenSearch data source

The OpenSearch data source plugin lets you query and visualize data from OpenSearch and Amazon OpenSearch Service in Grafana. You can build queries using Lucene or [Piped Processing Language (PPL)](https://opensearch.org/docs/latest/search-plugins/sql/ppl/index/), visualize logs, metrics, and traces, and create annotations from OpenSearch data. The plugin also supports AWS Signature Version 4 (SigV4) authentication for Amazon OpenSearch Service and Amazon OpenSearch Serverless.

## Supported features

The following table lists the features available with the OpenSearch data source:

| Feature        | Supported         |
| -------------- | ----------------- |
| Alerting       | Yes               |
| Annotations    | Yes               |
| Logs           | Yes               |
| Metrics        | Yes               |
| Traces         | Yes (Lucene only) |
| Ad hoc filters | Yes               |

## Get started

The following pages help you set up and use the OpenSearch data source:

- [Configure the OpenSearch data source](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/configure/)
- [OpenSearch query editor](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/query-editor/)
- [Template variables](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/template-variables/)
- [Annotations](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/annotations/)
- [Alerting](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/alerting/)
- [Troubleshooting](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/troubleshooting/)

## Additional features

After configuring the data source, you can:

- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to run ad hoc queries and investigate your OpenSearch data without building a dashboard.
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results.
- Set up [alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/) to receive notifications when your data matches specific conditions.

## Plugin updates

Always ensure that your plugin version is up-to-date so you have access to all current features and improvements. Navigate to **Plugins and data** > **Plugins** to check for updates. Grafana recommends upgrading to the latest Grafana version, and this applies to plugins as well.

{{< admonition type="note" >}}
Plugins are automatically updated in Grafana Cloud.
{{< /admonition >}}

## Related resources

- [OpenSearch documentation](https://opensearch.org/docs/latest/)
- [OpenSearch plugin GitHub repository](https://github.com/grafana/opensearch-datasource/)
- [Grafana community forum](https://community.grafana.com/)
