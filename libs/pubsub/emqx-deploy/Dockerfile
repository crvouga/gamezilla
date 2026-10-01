# Version pin for the local EMQX sidecar. Not deployed.
ARG EMQX_VERSION=5.8.6
ARG CADDY_VERSION=2.9.1

FROM caddy:${CADDY_VERSION}-alpine AS caddy

FROM emqx/emqx:${EMQX_VERSION}

USER root
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy

COPY config/emqx.conf /opt/emqx/etc/emqx.conf
COPY Caddyfile /etc/caddy/Caddyfile
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && chown -R emqx:emqx /opt/emqx/data /opt/emqx/etc

# Credentials are never baked into the image. The laptop sidecar injects them.
ENV EMQX_NODE__DATA_DIR=/opt/emqx/data \
    EMQX_LISTENERS__TCP__DEFAULT__BIND=127.0.0.1:1883 \
    EMQX_LISTENERS__WS__DEFAULT__BIND=127.0.0.1:8083 \
    EMQX_LISTENERS__WS__DEFAULT__WEBSOCKET__MQTT_PATH=/mqtt \
    EMQX_DASHBOARD__LISTENERS__HTTP__BIND=127.0.0.1:18083 \
    PORT=8080

EXPOSE 8080
# Starts as root on purpose: Railway mounts the data volume root-owned at run
# time (the chown above only covers the image layer), so the entrypoint fixes
# ownership and then drops to `emqx` before starting anything.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
