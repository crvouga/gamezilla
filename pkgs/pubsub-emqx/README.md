# `@pkgs/pubsub-emqx`

EMQX adapter for `@pkgs/pubsub`. Two factories, **one** returned type (`PubSub`):

- `createEmqxPubSub` — full-duplex MQTT over WebSocket (client environments).
- `createEmqxHttpPubSub` — publish-only HTTP (Cloudflare Workers / stateless servers).

## Broker config expectations (EMQX 5.x)

Preferred local broker: `@apps/emqx` via `bun dev` (ports 8083 / 18083). Production: Railway at `emqx.gamezilla.app` (provisioned by `@libs/infra`).

Operators / broker should configure:

- `allow_anonymous = false`
- MQTT authentication (JWT-as-password is the intended client pattern: `auth()` returns fresh `{ username, password }` on every reconnect)
- WebSocket listener path `/mqtt` (wss URL ends with `/mqtt`)
- Dashboard API key + secret for `POST /api/v5/publish` and `DELETE /api/v5/clients/{clientid}`
- No retained messages required for this port (adapter always publishes `qos: 0`, `retain: false`)

Fallback local install: `brew install emqx` (or EMQX 5.x tarball). CI daemon packaging is intentionally not wired yet.

## Usage — full-duplex (WSS)

```ts
import { createEmqxPubSub } from '@pkgs/pubsub-emqx/create-emqx-pubsub';

const bus = createEmqxPubSub({
  url: 'wss://broker.example/mqtt',
  clientIdPrefix: 'gamezilla',
  auth: async () => ({
    username: 'device',
    password: await fetchJwt(),
  }),
  keepaliveSec: 30,
});

const unsub = bus.subscribe('space:abc', (data) => {
  console.log(data);
});
await bus.publish('space:abc', { type: 'ping' });
unsub();
bus.close();
```

## Usage — publish-only (HTTP)

```ts
import { createEmqxHttpPubSub } from '@pkgs/pubsub-emqx/create-emqx-http-pubsub';

const bus = createEmqxHttpPubSub({
  apiBaseUrl: 'https://broker.example:18083',
  apiKey: env.EMQX_API_KEY,
  apiSecret: env.EMQX_API_SECRET,
  // fetchImpl: fetch, // optional inject for Workers / tests
});

await bus.publish('space:abc', { type: 'nudge' });
// bus.subscribe(...) throws PubSubNotSupportedError
bus.close();
```

## Expo / Metro polyfill inventory

`mqtt.js` over WSS needs platform `WebSocket` (already used by `@pkgs/room`) and `Buffer` (already in `@pkgs/polyfill`). It typically also pulls Node-core names (`events`, `process`, `stream`) that **this repo does not polyfill today**. Do not silently add them here — composition-root wiring owns any Metro aliases if/when a client consumer is added.

## Broker contract tests

Default `bun test` loud-skips when the broker is unreachable (CI stays green).

```bash
export EMQX_TEST_URL=ws://127.0.0.1:8083/mqtt
export EMQX_TEST_API_URL=http://127.0.0.1:18083
export EMQX_TEST_API_KEY=...
export EMQX_TEST_API_SECRET=...
export EMQX_TEST_MQTT_USER=...
export EMQX_TEST_MQTT_PASS=...
bun run --filter @pkgs/pubsub-emqx test:broker
```

`disruptTransport` uses `DELETE /api/v5/clients/{clientid}` to exercise reconnect + full re-SUBSCRIBE.
