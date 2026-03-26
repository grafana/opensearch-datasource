---
aliases:
  - /docs/plugins/grafana-opensearch-datasource/configure/
description: Configure the OpenSearch data source in Grafana, including authentication, AWS SigV4, and provisioning.
keywords:
  - grafana
  - opensearch
  - configuration
  - authentication
  - sigv4
  - aws
  - provisioning
  - amazon opensearch service
  - serverless
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure the OpenSearch data source
weight: 100
review_date: "2026-03-26"
---

# Configure the OpenSearch data source

This document explains how to configure the OpenSearch data source in Grafana.

## Before you begin

Before configuring the data source, ensure you have:

- **Grafana permissions:** `Organization administrator` role to add and configure data sources.
- **OpenSearch instance:** A running OpenSearch or Elasticsearch instance accessible from your Grafana server.
- **Credentials:** Authentication credentials for your OpenSearch instance, if required.

## Add the data source

To add the OpenSearch data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Type `OpenSearch` in the search bar.
1. Select **OpenSearch**.
1. Click **Add new data source**.

## Configure settings

The following table describes the connection settings:

| Setting     | Description                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------- |
| **Name**    | The name used to refer to the data source in panels and queries.                                |
| **Default** | Toggle to make this the default data source for new panels.                                     |
| **URL**     | The HTTP protocol, IP address, and port of your OpenSearch instance, for example `http://localhost:9200`. |

### OpenSearch details

These settings control how Grafana connects to and queries your OpenSearch index.

| Setting                            | Description                                                                                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Index name**                     | The default OpenSearch index name. You can use a time pattern such as `[logstash-]YYYY.MM.DD` or a wildcard. When using a time pattern, wrap the fixed portion in square brackets. Cross-cluster index patterns (for example, `cluster_name:index_name`) are also supported. |
| **Pattern**                        | The matching pattern for the index name. Options: **No pattern**, **Hourly**, **Daily**, **Weekly**, **Monthly**, **Yearly**. Only select a pattern if you've specified a time pattern in **Index name**.   |
| **Time field name**                | The name of the time field in your index. Defaults to `@timestamp`.                                                                                                                                        |
| **Serverless**                     | Toggle to enable Amazon OpenSearch Serverless mode. When enabled, the flavor is set to OpenSearch, version to `1.0.0`, and PPL is enabled automatically. The **Version** and **Max concurrent Shard Requests** fields are hidden. |
| **Version**                        | The version of your OpenSearch or Elasticsearch instance. Click **Get Version and Save** to auto-detect the version. This is required because query composition differs between versions. Hidden when **Serverless** is enabled. |
| **Max concurrent Shard Requests**  | The maximum number of concurrent shard requests per query. Available for OpenSearch and Elasticsearch 5.6+. Hidden when **Serverless** is enabled.                                                         |
| **Min time interval**              | The lower limit for the auto group-by time interval. Set this to your data's write frequency, for example `1m` if data is written every minute. You can also override this per panel.                      |
| **PPL enabled**                    | Toggle to enable [Piped Processing Language (PPL)](https://opensearch.org/docs/latest/search-plugins/sql/ppl/index/) queries in the query editor. Enabled by default.                                      |

{{< admonition type="note" >}}
When the connected OpenSearch instance is upgraded, update the configured version to match. The plugin uses the configured version to compose queries, and a mismatch can cause errors.
{{< /admonition >}}

The **Min time interval** value must be a number followed by a valid time identifier:

| Identifier | Description |
| ---------- | ----------- |
| `y`        | year        |
| `M`        | month       |
| `w`        | week        |
| `d`        | day         |
| `h`        | hour        |
| `m`        | minute      |
| `s`        | second      |
| `ms`       | millisecond |

### Log settings

These optional settings control how log data is displayed in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/).

| Setting                | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| **Message field name** | The field to use for log messages. Defaults to `_source`.      |
| **Level field name**   | The field to use for log levels.                               |

For example, if you use a default Filebeat setup to ship logs to OpenSearch, set **Message field name** to `message` and **Level field name** to `fields.level`.

### Data links

Data links create a link from a specified field that you can access in Explore's log view.

Each data link configuration consists of:

| Setting           | Description                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Field**         | The name of the field used by the data link. Can be an exact field name or a regex pattern that matches the field name.                                 |
| **Title**         | An optional display title for the link.                                                                                                                |
| **URL**           | The full URL for an external link. Use `${__value.raw}` to interpolate the field value. When **Internal link** is enabled, this field changes to **Query** and sets the query for the target data source. |
| **Internal link** | Toggle to use an internal link. When enabled, a data source picker appears to select the target tracing data source.                                   |

## Authentication

The OpenSearch data source supports several authentication methods.

### Basic authentication

To use basic authentication:

1. Enable **Basic auth** in the data source settings.
1. Enter the **User** and **Password** for your OpenSearch instance.

### TLS client authentication

To use TLS client authentication:

1. Enable **TLS Client Auth** in the data source settings.
1. Provide the **CA Cert**, **Client Cert**, and **Client Key**.
1. Optionally enable **Skip TLS Verify** to bypass certificate validation (not recommended for production).

### AWS SigV4 authentication

To sign requests to Amazon OpenSearch Service using AWS Signature Version 4:

1. Enable SigV4 in your Grafana [configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#sigv4_auth_enabled).
1. In the data source settings, enable **SigV4 auth**.
1. Configure the authentication provider:
   - **Access & secret key:** Enter your AWS access key and secret key directly.
   - **Credentials file:** Use a shared credentials file on the Grafana server.
   - **Workspace IAM role:** Use the IAM role attached to the Grafana workspace (Grafana Cloud or Amazon Managed Grafana).

| Setting                     | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| **Authentication provider** | Method for providing AWS credentials.                        |
| **Default region**          | The AWS region of your OpenSearch Service domain.            |
| **Assume Role ARN**         | Optional ARN of an IAM role to assume.                       |
| **External ID**             | Optional external ID for cross-account role assumption.      |

For more information about AWS authentication options, refer to [AWS authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/aws-authentication/).

### OAuth pass-through

When `oauthPassThru` is enabled in the data source configuration, Grafana forwards the user's OAuth token to OpenSearch with each request. This is configured through provisioning or the Grafana API.

## Private data source connect (PDC)

Use private data source connect (PDC) to connect to and query data within a secure network without opening that network to inbound traffic from Grafana Cloud. For more information, refer to [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) and [Configure PDC](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/).

If you use PDC with SigV4, the PDC agent must allow internet egress to `sts.<region>.amazonaws.com:443`.

To configure PDC, click in the **Private data source connect** box to select an existing PDC connection from the drop-down or create a new one.

## Amazon OpenSearch Service

AWS users can use this data source to visualize data from Amazon OpenSearch Service. If you use an AWS Identity and Access Management (IAM) policy to control access to your domain, you must use AWS SigV4 to sign all requests.

For more information about AWS SigV4, refer to the [AWS documentation](https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html).

### IAM policies for OpenSearch Service

Grafana needs permissions granted through IAM to read OpenSearch Service documents. You can attach these permissions to IAM roles and use Grafana's built-in support for assuming roles. [Configure the required policy](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_create.html) before adding the data source to Grafana.

For predefined policies, refer to the [Amazon OpenSearch Service managed policies documentation](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/ac-managed.html).

The following is an example of a minimal policy for querying OpenSearch Service:

{{< admonition type="note" >}}
Update the ARN to match your OpenSearch Service domain.
{{< /admonition >}}

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["es:ESHttpGet", "es:ESHttpPost"],
      "Resource": "arn:aws:es:<REGION>:<ACCOUNT_ID>:domain/<DOMAIN_NAME>"
    }
  ]
}
```

## Amazon OpenSearch Serverless

Amazon OpenSearch Serverless lets you run OpenSearch workloads without managing infrastructure. Access is controlled by [data access policies](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-data-access.html).

To use Serverless mode, enable the **Serverless** toggle in the data source settings. This automatically sets the flavor and version.

### Data access policies for OpenSearch Serverless

The following example shows a policy that allows querying a collection and index:

{{< admonition type="note" >}}
Replace the placeholder values for collection name, index name, and Principal with your values.
{{< /admonition >}}

```json
[
  {
    "Rules": [
      {
        "Resource": ["collection/<COLLECTION_NAME>"],
        "Permission": ["aoss:DescribeCollectionItems"],
        "ResourceType": "collection"
      },
      {
        "Resource": ["index/<COLLECTION_NAME>/<INDEX_NAME>"],
        "Permission": ["aoss:DescribeIndex", "aoss:ReadDocument"],
        "ResourceType": "index"
      },
      {
        "Effect": "Allow",
        "Action": "aoss:APIAccessAll",
        "Resource": "arn:aws:aoss:<REGION>:<ACCOUNT_ID>:collection/<COLLECTION_NAME>"
      },
      {
        "Effect": "Allow",
        "Action": ["aoss:BatchGetCollection", "aoss:ListCollections"],
        "Resource": "*"
      }
    ],
    "Principal": ["arn:aws:iam:<REGION>:<ACCOUNT_ID>:user/<USERNAME>"],
    "Description": "read-access"
  }
]
```

## Verify the connection

Click **Save & test** to verify the connection. On success, the data source returns one of the following messages:

| Message                                                    | Meaning                                                                                              |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Index OK. Time field name OK.**                          | The index was found and the time field is a valid date type.                                         |
| **Index OK. Note: No field named `<timeField>` found**     | The index exists but the specified time field wasn't found in the index mappings.                    |
| **Index OK. Note: `<timeField>` is not a date field**      | The index exists and the time field was found, but it isn't mapped as a date type.                   |
| **Fields fetched OK. Index not set.**                      | The connection succeeded but no index name is configured.                                            |

## Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system. For more information, refer to [Provisioning Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).

The following example provisions an OpenSearch data source with basic authentication:

```yaml
apiVersion: 1

datasources:
  - name: OpenSearch
    type: grafana-opensearch-datasource
    access: proxy
    url: <OPENSEARCH_URL>
    basicAuth: true
    basicAuthUser: <USERNAME>
    jsonData:
      flavor: opensearch
      version: "2.18.0"
      database: <INDEX_NAME>
      timeField: "@timestamp"
      logMessageField: message
      logLevelField: level
      pplEnabled: true
      serverless: false
      maxConcurrentShardRequests: 5
      timeInterval: 10s
    secureJsonData:
      basicAuthPassword: <PASSWORD>
```

The following table describes the available `jsonData` provisioning options:

| Field                        | Description                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `flavor`                     | `opensearch` or `elasticsearch`.                                                                   |
| `version`                    | The version of your OpenSearch or Elasticsearch instance, for example `2.18.0`.                    |
| `database`                   | The default index name.                                                                            |
| `timeField`                  | The time field name. Defaults to `@timestamp`.                                                     |
| `logMessageField`            | The field used for log messages.                                                                   |
| `logLevelField`              | The field used for log levels.                                                                     |
| `pplEnabled`                 | Set to `true` to enable PPL queries.                                                               |
| `serverless`                 | Set to `true` for Amazon OpenSearch Serverless.                                                    |
| `maxConcurrentShardRequests` | Maximum concurrent shard requests per query.                                                       |
| `timeInterval`               | Minimum time interval for auto group-by, for example `10s`.                                        |
| `dataLinks`                  | Array of data link objects with `field`, `url`, and optional `title` properties.                    |
| `versionLabel`               | Display label for the version, for example `OpenSearch 2.18.0`. Optional.                          |

The following table describes the available `secureJsonData` provisioning options:

| Field               | Description                          |
| -------------------- | ------------------------------------ |
| `basicAuthPassword` | Password for basic authentication.   |

## Provision the data source using Terraform

You can provision the data source using the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs). The following example creates an OpenSearch data source with basic authentication:

```hcl
resource "grafana_data_source" "opensearch" {
  type = "grafana-opensearch-datasource"
  name = "OpenSearch"
  url  = "<OPENSEARCH_URL>"

  basic_auth_enabled  = true
  basic_auth_username = "<USERNAME>"

  json_data_encoded = jsonencode({
    flavor                     = "opensearch"
    version                    = "2.18.0"
    database                   = "<INDEX_NAME>"
    timeField                  = "@timestamp"
    logMessageField            = "message"
    logLevelField              = "level"
    pplEnabled                 = true
    serverless                 = false
    maxConcurrentShardRequests = 5
    timeInterval               = "10s"
  })

  secure_json_data_encoded = jsonencode({
    basicAuthPassword = "<PASSWORD>"
  })
}
```

For more information about the Grafana Terraform provider, refer to the [Grafana provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).
