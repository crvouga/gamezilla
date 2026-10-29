# Version pin for the local EMQX sidecar. Not deployed.
ARG EMQX_VERSION=5.8.6
ARG CADDY_VERSION=2.9.1
# Each base image is pinned to the digest its tag named when pinned, so a
# moved tag cannot change what builds. Bump a version and its digest together.
ARG CADDY_DIGEST=sha256:b4e3952384eb9524a887633ce65c752dd7c71314d2c2acf98cd5c715aaa534f0
ARG EMQX_DIGEST=sha256:a1e3d10fa1dcc8c94325b815a93b5b5974253a97cb36470b44e47d5d3ef9cd13

FROM caddy:${CADDY_VERSION}-alpine@${CADDY_DIGEST} AS caddy

FROM emqx/emqx:${EMQX_VERSION}@${EMQX_DIGEST}

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
# Starts as root so a root-owned data directory can be chowned, then the
# entrypoint drops to `emqx`. This image is the local version pin, not a
# deployed broker. Production MQTT is AWS IoT Core.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
