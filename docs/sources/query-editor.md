---
aliases:
  - /docs/plugins/grafana-opensearch-datasource/query-editor/
description: Use the OpenSearch query editor to build Lucene and PPL queries for metrics, logs, and traces.
keywords:
  - grafana
  - opensearch
  - query editor
  - lucene
  - ppl
  - metrics
  - logs
  - traces
  - service map
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Query editor
title: OpenSearch query editor
weight: 200
review_date: "2026-03-26"
---

# OpenSearch query editor

This document explains how to use the OpenSearch query editor to build queries for metrics, logs, and traces.

The query editor supports two query languages:

- **Lucene:** The default query language with support for metric aggregations, bucket aggregations, logs, raw data, and trace analytics.
- **PPL (Piped Processing Language):** An alternative query language that uses a pipe syntax for data exploration. PPL must be [enabled in the data source configuration](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/configure/).

Select the query language from the **Query type** drop-down at the top of the query editor.

## Lucene queries

Lucene is the default query language. When using Lucene, select a query type from the **Lucene Query Type** drop-down to control the kind of data returned.

The following Lucene query types are available:

| Query type       | Description                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Metric**       | Returns aggregated numeric data using metric and bucket aggregations. Use for time-series charts and statistics.    |
| **Logs**         | Returns log data for display in the logs panel or Explore.                                                          |
| **Raw Data**     | Returns raw documents in a table format.                                                                            |
| **Raw Document** | Returns raw document JSON.                                                                                          |
| **Traces**       | Returns distributed trace data for display in the trace view.                                                       |

### Metric queries

Metric queries combine metric aggregations with bucket aggregations to produce time-series or tabular data. Use the plus and minus icons to add or remove metrics and group-by clauses. Click on an aggregation to expand its options.

#### Metric aggregations

The following metric aggregations are available:

| Aggregation        | Description                                                                  |
| ------------------ | ---------------------------------------------------------------------------- |
| **Count**          | The number of documents matching the query.                                  |
| **Average**        | The average value of a numeric field.                                        |
| **Sum**            | The total value of a numeric field.                                          |
| **Min**            | The minimum value of a numeric field.                                        |
| **Max**            | The maximum value of a numeric field.                                        |
| **Extended Stats** | Extended statistics including variance, standard deviation, and bounds.      |
| **Percentiles**    | Values at specified percentile ranks.                                        |
| **Cardinality**    | The approximate distinct count of a field.                                   |

#### Bucket aggregations

Bucket aggregations group documents into buckets for metric calculation:

| Aggregation        | Description                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Date Histogram** | Groups documents by time intervals. This is the primary aggregation for time-series data.                              |
| **Histogram**      | Groups documents by numeric value intervals.                                                                           |
| **Terms**          | Groups documents by unique field values. Supports `execution_hint` for controlling how terms are collected.            |
| **Filters**        | Groups documents using custom Lucene filter queries.                                                                   |
| **Geo Hash Grid**  | Groups documents by geographic location.                                                                               |

#### Pipeline metrics

Pipeline aggregations compute values from the output of other aggregations rather than from documents directly. Use the eye icon next to a metric to hide it from the visualization while keeping it available as input for a pipeline metric.

The following pipeline aggregations are available:

| Aggregation        | Description                                                                      |
| ------------------ | -------------------------------------------------------------------------------- |
| **Moving Average** | Calculates the moving average of a metric over a window.                         |
| **Moving Function**| Applies a custom function over a sliding window of metric values.                |
| **Derivative**     | Calculates the rate of change of a metric.                                       |
| **Cumulative Sum** | Calculates a running total of a metric.                                          |
| **Bucket Script**  | Computes a value using a script that can reference multiple metrics.             |

#### Series naming and alias patterns

You can control the name of time series using the **Alias** field. The following patterns are supported:

| Pattern              | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| `{{term fieldname}}` | Replaced with the value of a terms group-by.                  |
| `{{metric}}`         | Replaced with the metric name, for example Average, Min, Max. |
| `{{field}}`          | Replaced with the metric field name.                          |

### Log queries

Select **Logs** as the Lucene query type to query log data. Enter a Lucene query to filter log messages, for example `fields.level:error` to show only error logs.

The fields used for log messages and log levels are configured in the [data source settings](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/configure/).

When using Explore, Grafana automatically generates a logs volume histogram alongside log results, showing the distribution of log entries over time.

### Raw Data and Raw Document queries

**Raw Data** returns documents in a tabular format suitable for the table panel. **Raw Document** returns the full document JSON. Both types accept a Lucene query string to filter results.

### Trace queries

Select **Traces** as the Lucene query type to query distributed trace data. Traces are only available using Lucene queries.

{{< admonition type="note" >}}
Trace analytics require traces ingested with [Data Prepper](https://opensearch.org/docs/latest/data-prepper/common-use-cases/trace-analytics/). Querying Jaeger trace data stored in OpenSearch in raw form (without Data Prepper) isn't supported for service map visualization.
{{< /admonition >}}

#### View all traces

To view a list of traces:

1. Leave the **Query** field blank or enter a Lucene query to filter.
1. Set **Lucene Query Type** to **Traces**.
1. Run the query.
1. Select the **Table** visualization if needed.

Click a trace ID in the table to open that trace in the Explore trace view.

#### View a single trace

To view a specific trace:

1. Enter `traceId: <YOUR_TRACE_ID>` in the **Query** field.
1. Set **Lucene Query Type** to **Traces**.
1. Run the query.
1. Select the **Traces** visualization if needed.

#### Service map

Toggle **Service Map** to visualize the relationships between services in your traced application as a node graph.

Each service is represented as a node showing:

- Average latency
- Average throughput per minute
- Error and success rates (shown as the node border)

Click any node to view all metrics for that service. Arrows between nodes represent requests between services — click an arrow to see the operations involved.

You can view the service map for all traces in the current time range or for a single trace by querying a specific `traceId`.

{{< admonition type="note" >}}
Querying service map data sends additional queries to OpenSearch.
{{< /admonition >}}

## PPL queries

[Piped Processing Language (PPL)](https://opensearch.org/docs/latest/search-plugins/sql/ppl/index/) is an alternative query language that uses a pipe (`|`) syntax to chain commands for data exploration and transformation.

To use PPL, ensure it's [enabled in the data source configuration](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/configure/).

### Write PPL queries

The PPL query editor provides:

- Syntax highlighting and auto-completion for PPL keywords and index fields
- Press **Shift+Enter** to run the query
- Sample queries available through the **Sample queries** button

To narrow down field suggestions, specify an index name in the [data source settings](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/configure/).

### PPL format options

Select a format from the **Format** drop-down to control how results are displayed:

| Format          | Description                                                             |
| --------------- | ----------------------------------------------------------------------- |
| **Time series** | Formats results as time-series data for graph visualizations.           |
| **Table**       | Formats results as a table.                                             |
| **Logs**        | Formats results as log entries for the logs panel or Explore.           |

For more information about PPL syntax and supported commands, refer to the [OpenSearch PPL documentation](https://opensearch.org/docs/latest/search-plugins/sql/ppl/index/).

## Ad hoc filters

The OpenSearch data source supports ad hoc filters for both Lucene and PPL queries. Ad hoc filters let you add key-value filters from the dashboard without modifying the query. Add an ad hoc filter variable to your dashboard, select the OpenSearch data source, and use it to dynamically filter query results.

For more information about ad hoc filters, refer to the [Grafana ad hoc filters documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters).
