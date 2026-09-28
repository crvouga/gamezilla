# `@pkgs/emqx-server`

Local EMQX broker process runner for dev, harness, and CI. Tests call
`startEmqxServer` with injected `clock`, `timers` and `http`; it resolves
only once this node answers its HTTP API and accepts MQTT. Pass
`isolatedEmqxPorts()` for free ports and a unique node name so parallel
suites and other worktrees never share a broker. SSL/WSS listeners are off
and the broker runs on two non-spinning Erlang schedulers (`ERL_FLAGS`).
The production broker on Railway is OpenTofu
(`libs/infra/tofu/modules/pubsub`).

Default ports (dev):

| Port | Role |
| --- | --- |
| 1883 | MQTT TCP |
| 8083 | MQTT WebSocket (`/mqtt`) |
| 18083 | Dashboard + HTTP API |
