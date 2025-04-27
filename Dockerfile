FROM grafana/grafana:10.4.3

RUN rm -rf /var/lib/grafana/plugins/grafana-opensearch-datasource

COPY ./dist /var/lib/grafana/plugins/grafana-opensearch-datasource

# Disable datasource signature
ENV GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=grafana-opensearch-datasource
ENV GF_PLUGINS_ALLOW_UNSIGNED_PLUGINS=grafana-opensearch-datasource

EXPOSE 3000

ENTRYPOINT [ "/run.sh" ]
