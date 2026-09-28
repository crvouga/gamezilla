# `@pkgs/emqx-server`

Local EMQX broker process runner for dev, harness, and CI. Tests call
`startEmqxServer`. The production broker on Railway is OpenTofu
(`libs/infra/tofu/modules/pubsub`).

| Port | Role |
| --- | --- |
| 1883 | MQTT TCP |
| 8083 | MQTT WebSocket (`/mqtt`) |
| 18083 | Dashboard + HTTP API |
