# `@pkgs/emqx-server-ts`

Local EMQX broker process runner for dev, harness, and CI. Tests call
`startEmqxServer` with injected `clock`, `timers` and `http`; it resolves
only once this node answers its HTTP API and accepts MQTT. Pass
`isolatedEmqxPorts()` for free ports and a unique node name so parallel
suites and other worktrees never share a broker. SSL/WSS listeners are off
and the broker runs on two non-spinning Erlang schedulers (`ERL_FLAGS`).
If the installed distribution's physical path contains whitespace, the runner
copies its binaries into a temporary runtime without whitespace. Relative
links stay within that copy; existing broker data and logs are not copied.
The runtime is removed when the broker exits, while its configured data
directory remains intact.
Deployed invalidation is AWS IoT Core
(`libs/infra-shared-ts/tofu/modules/pubsub`). This package is the laptop and harness
stand-in: those providers have no local mode.

Default ports (dev):

| Port | Role |
| --- | --- |
| 1883 | MQTT TCP |
| 8083 | MQTT WebSocket (`/mqtt`) |
| 18083 | Dashboard + HTTP API |

The pinned broker runs without dependency patches. Its launcher generates an
unquoted Erlang crash-dump argument, so the adapter sets `EMQX_LOG_DIR` to a
whitespace-free temporary path when the application's data directory contains
whitespace. That path is derived from the data directory and isolates brokers.
Application data continues to use the configured durable data directory.
