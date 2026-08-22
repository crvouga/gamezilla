# Multi-stage: Caddy + official EMQX 5.x for Railway (`$PORT` public HTTPS).
ARG EMQX_VERSION=5.8.6
ARG CADDY_VERSION=2.9.1

FROM caddy:${CADDY_VERSION}-alpine AS caddy

FROM emqx/emqx:${EMQX_VERSION}

USER root
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy

COPY config/emqx.conf /opt/emqx/etc/emqx.conf
COPY config/api-keys.bootstrap /opt/emqx/data/api-keys.bootstrap
COPY config/auth-built-in-db-bootstrap.csv /opt/emqx/data/auth-built-in-db-bootstrap.csv
COPY Caddyfile /etc/caddy/Caddyfile
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && chown -R emqx:emqx /opt/emqx/data /opt/emqx/etc

ENV EMQX_NODE__DATA_DIR=/opt/emqx/data \
    EMQX_API_KEY__BOOTSTRAP_FILE=/opt/emqx/data/api-keys.bootstrap \
    EMQX_AUTHENTICATION__1__MECHANISM=password_based \
    EMQX_AUTHENTICATION__1__BACKEND=built_in_database \
    EMQX_AUTHENTICATION__1__ENABLE=true \
    EMQX_AUTHENTICATION__1__BOOTSTRAP_FILE=/opt/emqx/data/auth-built-in-db-bootstrap.csv \
    EMQX_LISTENERS__TCP__DEFAULT__BIND=127.0.0.1:1883 \
    EMQX_LISTENERS__WS__DEFAULT__BIND=127.0.0.1:8083 \
    EMQX_LISTENERS__WS__DEFAULT__WEBSOCKET__MQTT_PATH=/mqtt \
    EMQX_DASHBOARD__LISTENERS__HTTP__BIND=127.0.0.1:18083 \
    PORT=8080

EXPOSE 8080
USER emqx
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
