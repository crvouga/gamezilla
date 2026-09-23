# `@pkgs/emqx-server`

Local EMQX broker process runner for dev and CI.

Production Railway deployment and provisioning live in `@libs/pubsub`.

| Port | Role |
| --- | --- |
| 1883 | MQTT TCP |
| 8083 | MQTT WebSocket (`/mqtt`) |
| 18083 | Dashboard + HTTP API |
