---
aliases:
  - /docs/plugins/grafana-opensearch-datasource/troubleshooting/
description: Troubleshoot common issues with the OpenSearch data source in Grafana.
keywords:
  - grafana
  - opensearch
  - troubleshooting
  - errors
  - authentication
  - connection
  - query
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot OpenSearch data source issues
weight: 500
review_date: "2026-03-26"
---

# Troubleshoot OpenSearch data source issues

This document provides solutions to common issues you might encounter when configuring or using the OpenSearch data source. For configuration instructions, refer to [Configure the OpenSearch data source](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/configure/).

## Authentication errors

These errors occur when credentials are invalid, missing, or don't have the required permissions.

### "Access denied" or authorization errors

**Symptoms:**

- **Save & test** fails with authorization errors
- Queries return access denied messages
- Fields or indices don't load in drop-downs

**Possible causes and solutions:**

| Cause               | Solution                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Invalid credentials | Verify your username and password or API key. Regenerate credentials if necessary.            |
| Missing permissions | Ensure the user or role has read access to the target indices.                                |
| Expired credentials | Create new credentials and update the data source configuration.                             |

### SigV4 authentication failures

**Symptoms:**

- **Save & test** fails when using AWS SigV4 authentication
- Error messages related to signature validation or authorization

**Possible causes and solutions:**

| Cause                        | Solution                                                                                                                                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wrong region                 | Verify the **Default region** matches the region where your OpenSearch Service domain is deployed.                                                                                                                                |
| Missing IAM permissions      | Ensure the IAM role or user has `es:ESHttpGet` and `es:ESHttpPost` permissions on the domain. Refer to [IAM policies for OpenSearch Service](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/configure/).  |
| Expired credentials          | Rotate the access keys and update the data source configuration.                                                                                                                                                                 |
| Incorrect assume role ARN    | Verify the ARN in **Assume Role ARN** is correct and the trust policy allows Grafana to assume the role.                                                                                                                         |
| Serverless service name      | Ensure the **Serverless** toggle is enabled for OpenSearch Serverless collections. SigV4 uses a different service name (`aoss`) for Serverless.                                                                                   |

## Connection errors

These errors occur when Grafana can't reach the OpenSearch instance.

### "Connection refused" or timeout errors

**Symptoms:**

- Data source test times out
- Queries fail with network errors
- Intermittent connection issues

**Solutions:**

1. Verify the **URL** in the data source settings is correct, including the protocol and port.
1. Check that the Grafana server can reach the OpenSearch instance over the network.
1. Verify firewall rules allow outbound traffic on the configured port.
1. For private networks, ensure VPN or private connectivity is configured.
1. For Grafana Cloud, configure [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) if accessing private resources.

### TLS or certificate errors

**Symptoms:**

- Errors related to certificate verification or TLS handshake failures
- "x509: certificate signed by unknown authority" errors

**Solutions:**

1. If using a self-signed certificate, provide the CA certificate in the **TLS/SSL Auth Details** section.
1. For testing, enable **Skip TLS Verify** in the data source settings (not recommended for production).
1. Ensure the certificate isn't expired.
1. Verify the certificate's Subject Alternative Name (SAN) matches the hostname in the URL.

## Configuration errors

These errors occur during data source setup or health checks.

### "No version set"

**Symptoms:**

- **Save & test** fails with "No version set"
- The version field is empty in the data source settings

**Solutions:**

1. Click **Save & test** to let the plugin auto-detect the OpenSearch version.
1. If auto-detection fails, verify the URL is correct and the OpenSearch instance is reachable.
1. Ensure the credentials have permissions to query the root endpoint.

### "ElasticSearch version is not supported"

**Symptoms:**

- **Save & test** returns a message stating the Elasticsearch version is not supported by the OpenSearch plugin

**Solutions:**

This error occurs when the plugin detects an Elasticsearch instance with version 7.11 or later. Use the [Elasticsearch data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/) instead.

### "Generated empty index list"

**Symptoms:**

- **Save & test** fails with "Generated empty index list"

**Solutions:**

This error occurs when using a time-based index pattern and no indices match the pattern within the health check window (the last six hours).

1. Verify the index name pattern and **Pattern** interval are correct.
1. Ensure indices exist that match the pattern for the most recent six-hour window.
1. If indices only exist for older data, use a static index name instead of a time-based pattern.

### "Unable to fetch fields from the datasource"

**Symptoms:**

- Drop-down menus for fields don't populate
- Error includes details from an OpenSearch `root_cause` response

**Solutions:**

1. Verify the index name is correct and the index exists.
1. Ensure the credentials have permissions to call the `_field_caps` API on the target index.
1. Check that the OpenSearch instance is reachable.

## Query errors

These errors occur when executing queries against OpenSearch.

### "No data" or empty results

**Symptoms:**

- Query executes without error but returns no data
- Panels show a "No data" message

**Possible causes and solutions:**

| Cause                              | Solution                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| Time range doesn't contain data    | Expand the dashboard time range or verify data exists in OpenSearch for the selected period.        |
| Wrong index selected               | Verify the **Index name** in the data source settings matches an index that contains data.         |
| Incorrect time field               | Verify the **Time field name** matches a date-type field in your index.                            |
| Query too restrictive              | Simplify or broaden the Lucene or PPL query.                                                       |
| Permissions issue                  | Verify the credentials have read access to the specific index.                                     |

### "Index not found"

**Symptoms:**

- **Save & test** returns "Index not found" errors
- Queries fail with index-related errors

**Solutions:**

1. Verify the index name in the data source settings exists in OpenSearch.
1. If using an index pattern with a time-based suffix, verify the **Pattern** setting matches your naming convention.
1. Check that the index hasn't been deleted or rolled over.
1. For time-based patterns, ensure data exists within the dashboard's time range.

### "Invalid queryType"

**Symptoms:**

- Query fails with an error stating the query type is invalid and must be Lucene or PPL

**Solutions:**

1. Verify the query type is set to either **Lucene** or **PPL** in the query editor.
1. If using provisioned dashboards, ensure the `queryType` field in the query JSON is set to `"lucene"` or `"ppl"`.

### PPL query errors

**Symptoms:**

- PPL queries fail with syntax errors or an HTTP status code error from the OpenSearch PPL engine
- Error includes the status code and an OpenSearch `reason` message

**Solutions:**

1. Verify PPL is [enabled in the data source settings](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/configure/).
1. Check the PPL syntax against the [OpenSearch PPL documentation](https://opensearch.org/docs/latest/search-plugins/sql/ppl/index/).
1. Verify the index name in the `source` command matches an existing index.
1. For OpenSearch Serverless, ensure PPL is supported for your collection type.

### PPL time-series parsing errors

**Symptoms:**

- PPL query with **Time series** format fails with one of the following errors:
  - "response should have 2 fields but found N"
  - "found non-numerical value in value field"
  - "a valid time field type was not found in response"
  - "unable to parse time field"

**Solutions:**

1. Ensure the PPL query returns exactly two columns: a timestamp field and a numeric value field. Use `stats` to aggregate and limit to two columns.
1. Verify the timestamp column has a type of `timestamp`, `datetime`, or `date` in the OpenSearch index mapping.
1. Verify the value column contains only numeric data.
1. Test the query in OpenSearch Dashboards or the PPL CLI to inspect the returned schema.

### Trace and service map errors

**Symptoms:**

- Trace queries return errors related to service map fetching
- Error messages such as "Error fetching service map info"
- Span start times or event times fail to parse

**Solutions:**

1. Ensure the **Service Map** toggle is enabled only when your data includes the required service map fields.
1. Verify trace data in the target index follows the expected [Data Prepper](https://opensearch.org/docs/latest/data-prepper/) schema.
1. Check that `startTime` and event `time` fields are in a parseable format.

### Query timeout

**Symptoms:**

- Query runs for a long time then fails
- Error mentions timeout or query limits

**Solutions:**

1. Narrow the dashboard time range to reduce data volume.
1. Add filters to the query to reduce the result set.
1. Increase the **Max concurrent shard requests** setting if queries involve many shards.
1. Break complex aggregation queries into smaller parts.

## Template variable errors

These errors occur when using template variables with the data source.

### Variables return no values

**Solutions:**

1. Verify the data source connection is working using **Save & test**.
1. Check that the JSON query syntax is valid, for example `{"find": "terms", "field": "@hostname"}`.
1. Ensure the field name in the query exists in the index and has the correct type.
1. For cascading variables, verify that parent variables have valid selections.
1. Check that the credentials have permissions to query the target index.

### "Invalid query" or sort errors

**Symptoms:**

- Template variable query fails with "Invalid query"
- Error mentions an invalid query sort order or sort type

**Solutions:**

1. Ensure the JSON includes valid `find` and `field` properties.
1. If using `orderBy`, set it to `"term"`, `"key"`, or `"doc_count"`.
1. If using `order`, set it to `"asc"` or `"desc"`.

### Variables are slow to load

**Solutions:**

1. Set the variable refresh to **On dashboard load** instead of **On time range change** if the variable values don't change with time.
1. Add a `size` property to limit the number of returned values, for example `{"find": "terms", "field": "@hostname", "size": 100}`.
1. Narrow the dashboard time range to reduce the data scanned by the terms aggregation.

## Annotation errors

These errors occur when querying OpenSearch for annotation data.

### "Error querying annotations"

**Symptoms:**

- Annotations don't appear on dashboard graphs
- Error notification shows "Error querying annotations" followed by a reason

**Solutions:**

1. Verify the data source connection is working using **Save & test**.
1. Check that the Lucene query in the annotation configuration is syntactically valid.
1. Ensure the **Time** field is mapped to a valid date field in your index (default: `@timestamp`).
1. Verify the credentials have read access to the target index.

### Annotations don't support PPL

If you've configured an annotation query using PPL syntax, the query fails because annotations only support Lucene queries. Rewrite the annotation query using Lucene syntax.

## Alerting errors

These errors occur when creating or evaluating alert rules with OpenSearch queries.

### Unsupported query type for alerting

**Symptoms:**

- Alert rule evaluation returns no data or an error
- Alert preview shows unexpected results

**Solutions:**

Only Lucene **Metric** and PPL **Time series** query types reliably produce numeric time-series data for alerting. Logs, Raw Data, Raw Document, and Traces query types return data in formats that can't be evaluated by alert conditions. Refer to [Supported query types](https://grafana.com/docs/plugins/grafana-opensearch-datasource/latest/alerting/) for details.

### PPL alert query fails with format errors

**Symptoms:**

- Alert evaluation fails with errors such as "response should have 2 fields" or "found non-numerical value in value field"

**Solutions:**

1. Change the **Format** drop-down from **Table** (the default) to **Time series** in the query editor.
1. Ensure the PPL query returns exactly two columns: a timestamp field and a numeric value field.
1. Use `stats` with a time aggregation to structure the output correctly, for example:

   ```
   source = my_index | eval dateValue = timestamp(timestamp) | stats count(response) by dateValue
   ```

## Enable debug logging

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Review logs in `/var/log/grafana/grafana.log` or your configured log location.
1. Look for OpenSearch-specific entries that include request and response details.
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

## Get additional help

If you've tried the solutions in this document and still encounter issues:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review the [OpenSearch plugin GitHub issues](https://github.com/grafana/opensearch-datasource/issues) for known bugs.
1. Consult the [OpenSearch documentation](https://opensearch.org/docs/latest/) for service-specific guidance.
1. Contact Grafana Support if you have a Grafana Cloud Pro or Advanced plan, or a Grafana Enterprise license.
1. When reporting issues, include:
   - Grafana version and plugin version
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Relevant configuration (redact credentials)
