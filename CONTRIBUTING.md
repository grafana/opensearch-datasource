# OpenSearch dev environment

## Running test OpenSearch instance

### Run docker env

`$ docker-compose up` starts a single node OpenSearch cluster & OpenSearch Dashboards

If cluster not starting with error `max virtual memory areas vm.max_map_count [65530] is too low...`, increase mmap limits by running as root:

```
sysctl -w vm.max_map_count=262144
```

### Add sample data

1. Go to the kibana (http://localhost:5601)
1. Login with `admin:admin`
1. At the welcome screen click _Add data_ and switch to the _Sample data_ tab.
1. Import _Sample web logs_ and any other by your choice.

## Data source configuration

URL: https://localhost:9200
Basic Auth: `admin:admin`
Skip TLS Verify: `true`

## How to set up local development environment to work with traces in Open Search

Open Search provides [sample apps](https://opensearch.org/docs/latest/observing-your-data/trace/getting-started/) that are instrumented and can generate trace data out of the box. One of them is the Jaeger HotROD demo.

### To set it up and add it as a Grafana datasource:

1. Clone the Data [Prepper project](https://github.com/opensearch-project/data-prepper)
2. Change the line `image: jaegertracing/example-hotrod:latest` to `image: jaegertracing/example-hotrod:1.41.0` in docker-compose.yml
3. Go to the `examples/jaeger-hotrod` directory and start the containers with `docker compose up`

- The app that generates the traces is at [:8000](http://localhost:8080). Clicking on the buttons in the app generates test traces.
- The Opensearch Dashboards is at [:5601](http://localhost:5601/app/observability-dashboards#/trace_analytics/home)(Passwords are always admin:admin)
- The Opensearch database is running at https://localhost:9200

In order to view generated traces in Grafana, add a new datasource, enter https://localhost:9200 as the url. Set “Skip TLS Verify” to true. The auth details are admin:admin.
After following the steps for querying traces from ../README.md, traces from the sample app should be displayed in the panel.

## Client certificate authentication (TLS)

Prerequisite: Install openssl if necessary, for example `brew install openssl` on MacOS.

The repo [opensearch-docker-compose](https://github.com/flavienbwk/opensearch-docker-compose) brings together all the OpenSearch documentation on how to set up TLS client authentication in Docker, similar to the Basic Auth example above.

### Using opensearch-docker-compose repo

1. Clone the repo
2. Follow the instructions to generate self-signed certificates
3. Run `docker-compose up` as in their instructions
4. Navigate to the OpenSearch Dashboard at https://localhost:5601/ and ingest sample data, for example Web Logs

#### ...with Grafana

5. Run Grafana locally with opensearch-datasource.
6. On the configuration page:
   - URL: https://localhost:9200
   - TLS Client Auth: toggle on
   - Skip TLS Verify: toggle on
   - With CA Cert: toggle on
   - CA Cert: paste `ca.pem` (generated earlier)
   - Client Cert: `admin.pem` (generated earlier)
   - Client Key: `admin.key` (generated earlier)
   - Time field name: needs to correspond with data, for example if you added sample Web Logs, the name is `timestamp`

#### ...with cURL

```
curl -XGET "https://localhost:9200/_msearch" -H 'Content-Type: application/json' --cert admin.pem --key admin.key --cacert ca.pem -d'
{ "index": "opensearch_dashboards_sample_data_logs"}
{ "query": { "match_all": {} }, "from": 0, "size": 10}
{ "index": "opensearch_dashboards_sample_data_ecommerce", "search_type": "dfs_query_then_fetch"}
{ "query": { "match_all": {} } }
'
```

### Background

Similar to above, a cluster with OpenSearch and OpenSearch Dashboards is defined in a docker-compose. A script is used to generate certificates and keys for: Certificate Authority (ca), Admin (admin), and each node of the cluster (e.g. os01).

The OpenSearch docs explain it best: "Certificates are used to secure transport-layer traffic (node-to-node communication within your cluster) and REST-layer traffic (communication between a client and a node within your cluster)."

The Certificate Authority is usually an entity which manages these certificates on the web, but when developing locally we generate our own CA locally against which our keys are validated.

We generated a private key (client key) for the admin role in OpenSearch, then use the local CA we generated to create a public certificate (client certificate). This is the Client Certificate and Client Key which is entered into Grafana.

The keys, certificates, and CA are referenced in the configuration of OpenSearch (in the docker-compose.yml and in custom configuration opensearch.yml). The association between these certificates in OpenSearch and the certificates provided by the client ("admin" certificate in Grafana) is what facilitates the authentication.

### Build a release

You need to have commit rights to the GitHub repository to publish a release.

1. Update the version number in the `package.json` file.
2. Update the `CHANGELOG.md` by copy and pasting the relevant PRs from [Github's Release drafter interface](https://github.com/grafana/opensearch-datasource/releases/new) or by running `yarn generate-release-notes` (you'll need to install the [gh cli](https://cli.github.com/) and [jq](https://jqlang.github.io/jq/) to run this command).
3. PR the changes.
4. Once merged, follow the Drone release process that you can find [here](https://github.com/grafana/integrations-team/wiki/Plugin-Release-Process#drone-release-process)

### References

- https://opensearch.org/docs/latest/security/authentication-backends/client-auth/
- https://opensearch.org/docs/latest/security/configuration/tls/
- https://opensearch.org/docs/latest/security/configuration/generate-certificates/
- https://github.com/flavienbwk/opensearch-docker-compose
