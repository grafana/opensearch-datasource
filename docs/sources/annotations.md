---
aliases:
  - /docs/plugins/grafana-opensearch-datasource/annotations/
description: Create annotations from OpenSearch data to overlay event markers on Grafana dashboard graphs.
keywords:
  - grafana
  - opensearch
  - annotations
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: OpenSearch annotations
weight: 400
review_date: "2026-03-26"
---

# OpenSearch annotations

Annotations let you overlay event information on top of graphs. You can query any OpenSearch index for annotation events to mark deployments, incidents, or other significant occurrences on your time-series visualizations.

For more information about annotations in Grafana, refer to [Annotate visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/).

## Create an annotation

To create an annotation using OpenSearch data:

1. Open your dashboard and click **Dashboard settings** (gear icon).
1. Select **Annotations** from the left menu.
1. Click **Add annotation query**.
1. Select your OpenSearch data source from the **Data source** drop-down.
1. Configure the annotation fields described in the following section.
1. Click **Save dashboard**.

## Annotation fields

The following table describes the fields available when configuring an OpenSearch annotation:

| Field        | Description                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Query**    | A Lucene query to filter annotation events. Leave blank to return all events.                                                               |
| **Time**     | The name of the time field. Must be a date field.                                                                                           |
| **Time End** | Optional name of the time end field. Must be a date field. When set, annotations are displayed as a region between **Time** and **Time End**.|
| **Text**     | The field to use for the annotation description.                                                                                            |
| **Tags**     | Optional field for event tags. Accepts an array or a CSV string.                                                                            |

## Region annotations

To display annotations as a highlighted region instead of a single point in time, configure both the **Time** and **Time End** fields. This is useful for marking events that have a duration, such as deployments or maintenance windows.

## Use template variables in annotations

You can use [template variables](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/template-variables/) in your annotation queries to create dynamic annotations that respond to dashboard variable selections. For example, use a `$hostname` variable in the **Query** field to filter annotations by the selected host.
