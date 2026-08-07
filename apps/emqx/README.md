# `@apps/emqx`

Local EMQX 5.x broker for `bun dev`, plus Railway deploy artifacts for production at `emqx.gamezilla.app`.

## Local (`bun dev`)

Turbo starts this package alongside `@apps/api` and `@apps/client`.

| Port  | Role                     |
| ----- | ------------------------ |
| 1883  | MQTT TCP                 |
| 8083  | MQTT WebSocket (`/mqtt`) |
| 18083 | Dashboard + HTTP API     |

**Defaults** (match `@pkgs/pubsub-emqx` contract-test env):

- MQTT user / password: `pubsub` / `pubsub`
- API key / secret: `pubsub-test` / `pubsub-test-secret`
- Session: MQTT 5 clients send `sessionExpiryInterval` 600s; broker
  `mqtt.session_expiry_interval = 10m`, `mqtt.max_mqueue_len = 1000`

```bash
export EMQX_TEST_URL=ws://127.0.0.1:8083/mqtt
export EMQX_TEST_API_URL=http://127.0.0.1:18083
export EMQX_TEST_API_KEY=pubsub-test
export EMQX_TEST_API_SECRET=pubsub-test-secret
export EMQX_TEST_MQTT_USER=pubsub
export EMQX_TEST_MQTT_PASS=pubsub
```

Binary resolution: `EMQX_BIN` → PATH / Homebrew → pinned tarball under `.cache/`.

Ctrl-C / `bun kill` tears down the process and reclaims ports.

## Production (Railway)

Provisioned by `@libs/infra` — no Railway dashboard required when `RAILWAY_TOKEN` is in secrets env `prd`:

```bash
# After adding RAILWAY_TOKEN to the secret store:
bun run infra provision   # or full: bun run infra deploy
```

Creates Railway project **`gamezilla`**, service **`emqx`**, custom domain **`emqx.gamezilla.app`**, Cloudflare CNAME/TXT, and seeds `EMQX_*` secrets.

Public URLs (Caddy on `$PORT`):

- WSS: `wss://emqx.gamezilla.app/mqtt`
- HTTP API: `https://emqx.gamezilla.app/api/v5/...`
- Health: `https://emqx.gamezilla.app/healthz`
