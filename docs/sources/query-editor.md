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
| **Unique Count**   | The approximate distinct count of a field (cardinality).                     |

#### Bucket aggregations

Bucket aggregations group documents into buckets for metric calculation:

| Aggregation        | Description                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| **Date Histogram** | Groups documents by time intervals. This is the primary aggregation for time-series data.      |
| **Histogram**      | Groups documents by numeric value intervals.                                                   |
| **Terms**          | Groups documents by unique field values.                                                       |
| **Filters**        | Groups documents using custom Lucene filter queries.                                           |
| **Geo Hash Grid**  | Groups documents by geographic location.                                                       |

Each bucket aggregation has additional settings you can expand by clicking on the aggregation row:

- **Date Histogram:** **Interval** (auto, 10s, 1m, 5m, 10m, 20m, 1h, 1d, or custom), **Min Doc Count**, **Trim Edges**, **Offset**.
- **Terms:** **Order** (Top/Bottom), **Size**, **Min Doc Count**, **Order By** (Term value, Doc Count, or a metric), **Missing**, **Execution Hint**.
- **Histogram:** **Interval** (numeric), **Min Doc Count**.
- **Filters:** Custom Lucene queries per filter, each with an optional **Label**.
- **Geo Hash Grid:** **Precision**.

#### Pipeline metrics

Pipeline aggregations compute values from the output of other aggregations rather than from documents directly. Use the eye icon next to a metric to hide it from the visualization while keeping it available as input for a pipeline metric.

The following pipeline aggregations are available:

| Aggregation        | Description                                                                      |
| ------------------ | -------------------------------------------------------------------------------- |
| **Moving Average** | Calculates the moving average of a metric over a window. Supports models: **Simple**, **Linear**, **Exponentially Weighted**, **Holt Linear**, and **Holt Winters**. |
| **Moving Function**| Applies a custom function over a sliding window of metric values.                                                                                                      |
| **Derivative**     | Calculates the rate of change of a metric.                                                                                                                             |
| **Cumulative Sum** | Calculates a running total of a metric.                                                                                                                                |
| **Bucket Script**  | Computes a value using a script that can reference multiple metrics. The scripting language is Painless; use `params.<var>` to reference variables.                     |

#### Series naming and alias patterns

You can control the name of time series using the **Alias** field. This field only appears for time-series queries where the last bucket aggregation is a **Date Histogram**.

The following patterns are supported:

| Pattern              | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| `{{term fieldname}}` | Replaced with the value of a terms group-by.                  |
| `{{metric}}`         | Replaced with the metric name, for example Average, Min, Max. |
| `{{field}}`          | Replaced with the metric field name.                          |

### Log queries

Select **Logs** as the Lucene query type to query log data. Enter a Lucene query to filter log messages.

The fields used for log messages and log levels are configured in the [data source settings](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/configure/).

When using Explore, Grafana automatically generates a logs volume histogram alongside log results, showing the distribution of log entries over time.

#### Lucene query examples

The following examples show common Lucene query patterns:

| Query                                             | Description                                                   |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `fields.level:error`                              | Matches documents where the level field is `error`.           |
| `FlightDelayType:"Carrier Delay" AND Carrier:Open*` | Combines an exact phrase match with a wildcard.             |
| `status:[400 TO 499]`                             | Matches documents with a status code in the 400-499 range.   |
| `message:"connection timeout" OR message:"refused"` | Matches documents containing either phrase.                 |
| `tags:error AND tags:security`                    | Matches documents with both tags.                             |
| `NOT status:200`                                  | Excludes documents with status 200.                           |
| `taxful_total_price:>250`                         | Matches documents where the price exceeds 250.                |

### Raw Data and Raw Document queries

**Raw Data** returns documents in a tabular format suitable for the table panel. **Raw Document** returns the full document JSON. Both types accept a Lucene query string to filter results.

Each type has the following settings:

| Setting            | Description                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| **Size**           | The maximum number of documents to return. Defaults to `500`.                                       |
| **Use time range** | Toggle to restrict results to the dashboard time range. When enabled, an **Order** option appears.  |
| **Order**          | Sort order for results: **Descending** or **Ascending**. Only available when **Use time range** is enabled. |

### Trace queries

Select **Traces** as the Lucene query type to query distributed trace data. Traces are only available using Lucene queries.

{{< admonition type="note" >}}
Trace analytics require traces ingested with [Data Prepper](https://opensearch.org/docs/latest/data-prepper/common-use-cases/trace-analytics/). Querying Jaeger trace data stored in OpenSearch in raw form (without Data Prepper) isn't supported for service map visualization.
{{< /admonition >}}

The trace query type has the following additional settings:

| Setting         | Description                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Service Map** | Toggle to request and display service map data for the trace(s). Refer to the service map section for details.  |
| **Size**        | The maximum number of traces to return. Defaults to `1000`, with a maximum value of `10000`. Hidden when **Service Map** is enabled. |

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
- Click **Kickstart your query** to open a modal with sample queries you can use as starting points

To narrow down field suggestions, specify an index name in the [data source settings](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/configure/).

### PPL format options

Select a format from the **Format** drop-down to control how results are displayed. The default format is **Table**.

| Format          | Description                                                             |
| --------------- | ----------------------------------------------------------------------- |
| **Table**       | Formats results as a table. Returns any set of columns.                 |
| **Logs**        | Formats results as log entries for the logs panel or Explore. Returns any set of columns. |
| **Time series** | Formats results as time-series data for graph visualizations. Requires a date/datetime/timestamp column as the time column and numeric columns as values. |

### PPL query examples

The following examples show common PPL query patterns:

Filter logs by a field value:

```
source = opensearch_dashboards_sample_data_logs | where geo.src = "US"
```

Search flights with conditions:

```
search source=opensearch_dashboards_sample_data_flights | where AvgTicketPrice > 1150 | where FlightDelay = true
```

Find documents where a field contains a specific word:

```
SOURCE = my_index | WHERE LIKE(title, '%wind%') LIMIT 10
```

Aggregate data for time-series visualization (use with **Time series** format):

```
source = my_index | eval dateValue = timestamp(timestamp) | stats count(response) by dateValue
```

For more information about PPL syntax and supported commands, refer to the [OpenSearch PPL documentation](https://opensearch.org/docs/latest/search-plugins/sql/ppl/index/).

## Ad hoc filters

The OpenSearch data source supports ad hoc filters for both Lucene and PPL queries. Ad hoc filters let you add key-value filters from the dashboard without modifying the query. Add an ad hoc filter variable to your dashboard, select the OpenSearch data source, and use it to dynamically filter query results.

For more information about ad hoc filters, refer to the [Grafana ad hoc filters documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters).

## Query language references

For detailed syntax and command documentation, refer to the official OpenSearch documentation:

- [Lucene query syntax](https://opensearch.org/docs/latest/query-dsl/full-text/query-string/)
- [PPL commands reference](https://opensearch.org/docs/latest/search-plugins/sql/ppl/index/)
- [PPL functions reference](https://opensearch.org/docs/latest/search-plugins/sql/ppl/functions/)
- [Metric aggregations](https://opensearch.org/docs/latest/aggregations/metric/)
- [Bucket aggregations](https://opensearch.org/docs/latest/aggregations/bucket/)
- [Pipeline aggregations](https://opensearch.org/docs/latest/aggregations/pipeline/)
- [Trace analytics with Data Prepper](https://opensearch.org/docs/latest/data-prepper/common-use-cases/trace-analytics/)
