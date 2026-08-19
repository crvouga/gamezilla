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
- MQTT session / mqueue caps for short offline drain (see `@apps/emqx` `emqx.conf`):
  - `mqtt.session_expiry_interval` (broker default for non-MQTT5; clients send MQTT5 `sessionExpiryInterval`)
  - `mqtt.max_mqueue_len` (cap offline queue length)
- Adapter publishes/subscribes at **QoS 1**, `retain: false`, MQTT **5**, `cleanStart: false`, stable `clientId` (= `clientIdPrefix`)

### Product topic helpers (Gamezilla)

Same grammar as `@pkgs/pubsub`. Helpers live in `@libs/runtime/public/sync-topics`:

- `user:{actorId}`
- `room:{spaceId}`

JWT ACL grants subscribe **and** publish on the actor's topic set (`user:{self}`,
membership `room:*`, `system:client_config`). Clients publish mutation fanout on
those topics; server pushes still use the HTTP publish API.

Fallback local install: `brew install emqx` (or EMQX 5.x tarball). CI daemon packaging is intentionally not wired yet.

## Offline session behavior

Short disconnects (minutes) can be bridged by the broker session:

1. Client connects MQTT 5 with stable `clientId`, `clean: false`, `sessionExpiryInterval` (600s).
2. Subscribe + publish use QoS 1 so EMQX can queue while the client is down.
3. On reconnect with the same id, the broker drains the mqueue; the adapter also re-SUBSCRIBEs.
4. Domain sync (`wakeAll` / HTTP query pull) remains the eventual-consistency backstop when the session expired or the mqueue overflowed.

One live connection per `clientId` — a second connect with the same id kicks the older connection. Production uses the device id as `clientIdPrefix`.

## Usage — full-duplex (WSS)

```ts
import { createEmqxPubSub } from '@pkgs/pubsub-emqx/create-emqx-pubsub';

const bus = createEmqxPubSub({
  url: 'wss://broker.example/mqtt',
  clientIdPrefix: 'device-abc', // stable MQTT client id
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

await bus.publish('space:abc', { type: 'push' });
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

`disruptTransport` uses `DELETE /api/v5/clients/{clientid}` to exercise reconnect + session resume / re-SUBSCRIBE.

## Production JWT authn

App clients authenticate with MQTT username `jwt` and password = short-lived HS256 JWT from `POST /api/pubsub/token`. Configure EMQX:

1. JWT authenticator (`mechanism = jwt`, `from = password`, HMAC secret = secrets `EMQX_JWT_SECRET`)
2. `acl_claim_name = acl` — subscribe-only rules embedded in the token
3. Prefer `authorization.no_match = deny` in production so clients cannot subscribe outside their ACL
4. Keep HTTP API keys (`EMQX_API_KEY` / `EMQX_API_SECRET`) for Worker publish-only pushes
