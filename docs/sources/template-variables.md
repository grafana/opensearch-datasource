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

The OpenSearch data source supports two types of queries for query variables. Queries are written as a JSON string in the **Query** field.

{{< admonition type="note" >}}
The query must be valid JSON. Invalid JSON causes the variable query to fail.
{{< /admonition >}}

To create a query variable:

1. Navigate to **Dashboard settings** > **Variables**.
1. Click **Add variable**.
1. Select **Query** as the variable type.
1. Select the OpenSearch data source.
1. Enter one of the JSON queries from the following table in the **Query** field.

### Find fields

Use `"find": "fields"` to return a list of field names from the index. Optionally filter by type:

```json
{"find": "fields", "type": "keyword"}
```

Other examples:

```json
{"find": "fields", "type": "number"}
```

```json
{"find": "fields", "type": "date"}
```

The `type` parameter is optional. Supported type values include:

| Type        | Description                                                         |
| ----------- | ------------------------------------------------------------------- |
| `keyword`   | Keyword (exact match) fields.                                       |
| `string`    | String fields including text and keyword types.                     |
| `number`    | Numeric fields (integer, long, float, double, etc.).                |
| `date`      | Date and date_nanos fields.                                         |
| `nested`    | Nested object fields.                                               |

Omitting the `type` parameter returns all eligible fields.

### Find terms

Use `"find": "terms"` to return a list of values for a field using term aggregation. Terms queries are always scoped to the current dashboard time range.

| Query                                                                                                                                                        | Description                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `{"find": "terms", "field": "@hostname", "size": 1000}`                                                                                                     | Returns values for a field using term aggregation.                                               |
| `{"find": "terms", "field": "@hostname", "query": "<lucene query>"}`                                                                                        | Returns values for a field with a Lucene query filter.                                           |
| `{"find": "terms", "script": "if(doc['@hostname'].value == 'x') { return null; } else { return doc['@hostname']}", "query": "<lucene query>"}`              | Returns values using the script API and a Lucene query filter.                                   |

The following table describes all available parameters for terms queries:

| Parameter | Description                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `field`   | The field to aggregate on. Use `field` or `script`, not both.                                                                                |
| `script`  | A script to compute values instead of using a field directly.                                                                                |
| `query`   | A Lucene query to filter documents before aggregation. Defaults to `*` (all documents).                                                      |
| `size`    | The maximum number of terms to return. Defaults to `500`.                                                                                    |
| `orderBy` | How to order results: `doc_count` (by frequency), `term` (alphabetical by value). Defaults to `term`.                                        |
| `order`   | Sort direction: `asc` or `desc`. Defaults to `asc` for term ordering, `desc` for `doc_count` ordering.                                       |

### Multi-field types

If the query targets a multi-field with both a text and keyword type, use `"field":"fieldname.keyword"` (or sometimes `fieldname.raw`) to specify the keyword field in your query.

### Use other variables in queries

You can reference other variables inside a query definition. For example, for a variable named `$host`:

```json
{"find": "terms", "field": "@hostname", "query": "@source:$source"}
```

In this example, the `$source` variable filters the `$host` variable. Changing the `$source` value triggers an update to the `$host` variable, returning only hostnames matching the selected `@source` value.

### Sort by document count

By default, terms queries return results sorted by term value. To sort by document count (top-N values), add `"orderBy": "doc_count"`:

```json
{"find": "terms", "field": "@hostname", "orderBy": "doc_count"}
```

This automatically selects descending order. You can explicitly set ascending order with `"order": "asc"`, but this is discouraged because it increases the error on document counts. Refer to the [OpenSearch terms aggregation documentation](https://opensearch.org/docs/latest/aggregations/bucket/terms/) for details.

To return the top 10 values by document count:

```json
{"find": "terms", "field": "@hostname", "orderBy": "doc_count", "order": "desc", "size": 10}
```

To keep terms in document count order in the dashboard drop-down, set the variable's **Sort** drop-down to **Disabled**. You can also use other sort options like **Alphabetical** to re-sort the results.

## Use variables in queries

There are two syntaxes for using variables in queries:

| Syntax         | Example                    | Notes                                                                           |
| -------------- | -------------------------- | ------------------------------------------------------------------------------- |
| `$<varname>`   | `@hostname:$hostname`      | Easier to read and write, but can't be used in the middle of a word.            |
| `[[varname]]`  | `@hostname:[[hostname]]`   | Can be used in the middle of a word.                                            |

### Lucene queries

When the **Multi-value** or **Include all value** options are enabled, Grafana converts the variable values into a Lucene-compatible OR condition.

You can use variables in the Lucene query field and in the **Terms** group-by field to dynamically change how data is filtered and grouped. For example:

```
@hostname:$hostname AND status:[400 TO 499]
```

### PPL queries

Variables in PPL queries are interpolated using CSV formatting. For example, a multi-value variable produces comma-separated values. You can use variables in PPL queries like this:

```
source = my_index | where hostname = '$hostname' | where status >= 400
```

## Ad hoc filters

Ad hoc filter variables let you add key-value filters from the dashboard without modifying the query. The OpenSearch data source supports ad hoc filters for both Lucene and PPL queries.

When you create an ad hoc filter variable:

- **Key suggestions** are populated from all available fields in the index.
- **Value suggestions** are populated using a terms aggregation on the selected key, scoped to the dashboard time range.

### Supported operators

The following operators are available for ad hoc filters:

| Operator | Lucene support | PPL support |
| -------- | -------------- | ----------- |
| `=`      | Yes            | Yes         |
| `!=`     | Yes            | Yes         |
| `=~`     | Yes            | No          |
| `!~`     | Yes            | No          |
| `<`      | Yes            | Yes         |
| `>`      | Yes            | Yes         |

{{< admonition type="note" >}}
Regex operators (`=~` and `!~`) are not supported in PPL queries and are silently ignored.
{{< /admonition >}}
