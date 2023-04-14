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

#### TODO: Fake Data gen


### How to set up local development environment to work with traces in Open Search

Open Search provides [sample apps](https://opensearch.org/docs/latest/observing-your-data/trace/getting-started/) that are instrumented and can generate trace data out of the box. One of them is  the Jaeger HotROD demo.

#### To set it up and add it as a Grafana datasource:

1. Clone the Data [Prepper project](https://github.com/opensearch-project/data-prepper)
2. Change the line `image:jaegertracing/example-hotrod:latest` to `image: jaegertracing/example-hotrod:1.41.0`
3. Go to the `examples/jaeger-hotrod` directory and start the containers with `docker compose up`

- The app that generates the traces is at [:8000](http://localhost:8080). Clicking on the buttons in the app generates test traces.
- The Opensearch Dashboards is at [:5601](http://localhost:5601/app/observability-dashboards#/trace_analytics/home)(Passwords are always admin:admin)
- The Opensearch database is running at https://localhost:9200

In order to view generated traces in Grafana, add a new datasource, enter https://localhost:9200 as the url. Set “Skip TLS Verify” to true. The auth details are admin:admin.
After following the steps for querying traces from ../README.md, traces from the sample app should be displayed in the panel. 
    
