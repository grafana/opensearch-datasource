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

### TODO: Fake Data gen

## Client certificate authentication (TLS) 

Prerequisite: Install openssl if necessary, for example `brew install openssl` on MacOS. 

The repo [opensearch-docker-compose](https://github.com/flavienbwk/opensearch-docker-compose) brings together all the OpenSearch documentation on how to set up TLS client authentication in Docker, similar to the Basic Auth example above.


Using the opensearch-docker-compose repo
1. Clone the repo
2. Follow the instructions to generate self-signed certificates
3. Run `docker-compose up` as in their instructions
4. Navigate to the OpenSearch Dashboard at https://localhost:5601/ and ingest sample data, for example Web Logs
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

### Background
Similar to above, a cluster with OpenSearch and OpenSearch Dashboards is defined in a docker-compose. A script is used to generate certificates and keys for: Certificate Authority (ca), Admin (admin), and each node of the cluster (e.g. os01).

The OpenSearch docs explain it best: "Certificates are used to secure transport-layer traffic (node-to-node communication within your cluster) and REST-layer traffic (communication between a client and a node within your cluster)."

The Certificate Authority is usually an entity which manages these certificates on the web, but when developing locally we generate our own CA locally against which our keys are validated.

We generated a private key (client key) for the admin role in OpenSearch, then use the local CA we generated to create a public certificate (client certificate). This is the Client Certificate and Client Key which is entered into Grafana.

Again, the other keys and certificates generated are used for secure node-to-node traffic.

### References
- https://opensearch.org/docs/latest/security/authentication-backends/client-auth/
- https://opensearch.org/docs/latest/security/configuration/tls/
- https://opensearch.org/docs/latest/security/configuration/generate-certificates/
- https://github.com/flavienbwk/opensearch-docker-compose
