---
aliases:
  - /docs/plugins/grafana-opensearch-datasource/template-variables/
description: Use template variables with the OpenSearch data source to create dynamic, reusable dashboards.
keywords:
  - grafana
  - opensearch
  - template variables
  - variables
  - dashboard
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: OpenSearch template variables
weight: 300
review_date: "2026-03-26"
---

# OpenSearch template variables

Instead of hard-coding values like server names, applications, or sensor names in your queries, you can use template variables. Variables appear as drop-down select boxes at the top of the dashboard, making it easy to change the data displayed.

For an introduction to template variables, refer to the [Grafana template variables documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/).

## Create a query variable

The OpenSearch data source supports two types of queries for query variables. Queries are written using a custom JSON string.

To create a query variable:

1. Navigate to **Dashboard settings** > **Variables**.
1. Click **Add variable**.
1. Select **Query** as the variable type.
1. Select the OpenSearch data source.
1. Enter one of the JSON queries from the following table in the **Query** field.

| Query                                                                                                                                                        | Description                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{"find": "fields", "type": "keyword"}`                                                                                                                     | Returns a list of field names with the index type `keyword`.                                                                                                    |
| `{"find": "terms", "field": "@hostname", "size": 1000}`                                                                                                     | Returns a list of values for a field using term aggregation. Uses the current dashboard time range.                                                             |
| `{"find": "terms", "field": "@hostname", "query": "<lucene query>"}`                                                                                        | Returns a list of values for a field using term aggregation with a Lucene query filter. Uses the current dashboard time range.                                  |
| `{"find": "terms", "script": "if(doc['@hostname'].value == 'x') { return null; } else { return doc['@hostname']}", "query": "<lucene query>"}`              | Returns a list of values using term aggregation with the script API and a Lucene query filter.                                                                  |

### Multi-field types

If the query targets a multi-field with both a text and keyword type, use `"field":"fieldname.keyword"` (or sometimes `fieldname.raw`) to specify the keyword field in your query.

### Size limit

There is a default size limit of 500 on terms queries. Set the `size` property in your query to use a custom limit.

### Use other variables in queries

You can reference other variables inside a query definition. For example, for a variable named `$host`:

```json
{"find": "terms", "field": "@hostname", "query": "@source:$source"}
```

In this example, the `$source` variable filters the `$host` variable. Changing the `$source` value triggers an update to the `$host` variable, returning only hostnames matching the selected `@source` value.

### Sort by document count

By default, terms queries return results in term order. To sort by document count (top-N values), add `"orderBy": "doc_count"`:

```json
{"find": "terms", "field": "@hostname", "orderBy": "doc_count"}
```

This automatically selects descending order. To keep terms in document count order, set the variable's **Sort** drop-down to **Disabled**. You can also use other sort options like **Alphabetical** to re-sort the results.

{{< admonition type="note" >}}
Using ascending order with `doc_count` is discouraged because it increases the error on document counts. Refer to the [OpenSearch terms aggregation documentation](https://opensearch.org/docs/latest/aggregations/bucket/terms/) for details.
{{< /admonition >}}

## Use variables in queries

There are two syntaxes for using variables in queries:

| Syntax         | Example                    | Notes                                                                           |
| -------------- | -------------------------- | ------------------------------------------------------------------------------- |
| `$<varname>`   | `@hostname:$hostname`      | Easier to read and write, but can't be used in the middle of a word.            |
| `[[varname]]`  | `@hostname:[[hostname]]`   | Can be used in the middle of a word.                                            |

When the **Multi-value** or **Include all value** options are enabled, Grafana converts the variable values into a Lucene-compatible condition.

You can also use variables in the **Terms** group-by field to dynamically change how data is grouped.
