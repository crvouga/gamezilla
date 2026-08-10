# `@pkgs/room`

Server-authoritative multiplayer for a **single topic** (e.g. `space:<uuid>`).

The **server** is the only writer to the committed event log. The **client** is optimistic and offline-friendly: it applies commands locally, persists a durable command queue, and replays after reconnect. Convergence is `sync(fromSeq)` plus server dedup by `commandId`.

## Entrypoints

Both the client and server entrypoints expose **core only** — engine + ports. Each adapter is its own subpath import so callers explicitly opt in to a runtime/backend, and swapping adapters is a one-line import change.

| Import                                           | Purpose                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `@pkgs/room`                                     | Core client: `Room` (flat `getSnapshot()` + `RoomMetaAttr`), `useRoomSnapshot`, registry hooks, ports, wire helpers |
| `@pkgs/room/server`                              | Core server: `RoomServer`, `RoomStorage`, `RoomAuth` (no adapters)                                                  |
| `@pkgs/room/client/adapters/transport/websocket` | `WebSocketRoomTransport` (browser/Worker `WebSocket`)                                                               |
| `@pkgs/room/client/adapters/storage/memory`      | `InMemoryClientStorage` (tests)                                                                                     |
| `@pkgs/room/client/adapters/storage/web`         | `WebClientStorage` (synchronous `localStorage`)                                                                     |
| `@pkgs/room/client/adapters/storage/key-value`   | `KeyValueClientRoomStorage` (async `Kv` — `localStorage` web, AsyncStorage native)                                  |
| `@pkgs/room/server/adapters/durable-object`      | `createDurableObjectAdapter`, `DurableObjectRoomStorage`, DO type stubs                                             |
| `@pkgs/room/server/adapters/memory`              | `InMemoryRoomStorage` (tests / loopback testkit)                                                                    |
| `@pkgs/room/testkit`                             | `openLoopbackRoom`, `LoopbackRoomTransport`, `TestCounterModule`                                                    |

The folder layout mirrors the entrypoint layout:

```
pkgs/room/src/
├── client/
│   ├── core/                               (Room engine, hook, ports)
│   └── adapters/
│       ├── storage/{memory,web,key-value}/ (ClientRoomStorage impls)
│       └── transport/websocket/            (ClientTransport impl)
├── server/
│   ├── core/                               (RoomServer, ports)
│   └── adapters/{durable-object,memory}/   (RoomStorage impls + DO host)
├── sim/                                    (private DST harness)
└── tests/
    ├── fixtures/                           (TestCounterModule, …)
    ├── harness/                            (openLoopbackRoom, LoopbackRoomTransport)
    └── scenarios/                          (DST *.sim.test.ts; import sim + fixtures)
```

A new runtime (Node HTTP server, Postgres-backed storage, WebRTC transport, etc.) is a new folder under the matching `adapters/…` slot plus one entry in `package.json#exports` — the core engines stay untouched.

## Core types

- **`RoomModuleName`** — branded wire id for DO routing (`module` query). Validated by {@link parseRoomModuleName} / {@link assertRoomModuleName} against `^[a-z]+(?:-[a-z]+)*$`.
- **`RoomModule<S, C, E, Identity>`** — `name` ({@link RoomModuleName}), `initialState`, `handle(state, command, identity)`, `reduce(state, event)`.
- **`RoomCommand<C>`** — `{ id, ts, payload }` (client generates `id`; server treats it as idempotency key).
- **`HandleResult<E>`** — `{ ok: true, events }` or `{ ok: false, error: RoomError }`.
- **`RoomError`** — small union; `type` is a Clojure-style namespaced keyword: `room.error/invalid-command`, `room.error/unauthorized`, `room.error/conflict`, `room.error/rate-limited`, `room.error/internal`. Constants live in `ROOM_ERROR_TYPE`.

## Wire protocol

Versioned JSON frames (`v` on envelopes). Each envelope `kind` is a plain string-literal discriminator (constants in `ROOM_WIRE_KIND`); the wire is a static contract, not dynamic app data, so it is a rigid TypeScript discriminated union and intentionally does not use the `Keyword`/attribute machinery reserved for room state and message types. Client → server: `command`, `sync`, `ping`. Server → client: `welcome`, `committed`, `rejected`. Each committed event has a monotonic **`seq`** per topic.

## Ports (inject, do not singleton)

- **`ClientTransport`** — connect, send JSON, subscribe to inbound, lifecycle hooks (`onHandlers`).
- **`ClientRoomStorage`** — durable committed tail + queued commands (`appendQueued`, `removeQueued`, `loadQueued`, `saveCommitted`, `loadCommitted`).
- **`RoomStorage` (server)** — append/load log, `nextSeq`, command dedup (`seenCommandId`, `recordCommandId`).
- **`RoomAuth`** — authenticate WebSocket upgrade; optional `authorize` per command.

## Shipped adapters

- **Client transport — `websocket`** (`@pkgs/room/client/adapters/transport/websocket`): `WebSocketRoomTransport` with exponential backoff reconnect, application-level `ping`/`pong` heartbeat, and `probeLiveness()` for app-foreground recovery.
- **Client storage — `memory`** (`@pkgs/room/client/adapters/storage/memory`): `InMemoryClientStorage` for tests and the loopback testkit.
- **Client storage — `web`** (`@pkgs/room/client/adapters/storage/web`): `WebClientStorage` for synchronous `localStorage`.
- **Client storage — `key-value`** (`@pkgs/room/client/adapters/storage/key-value`): `KeyValueClientRoomStorage` for client `Kv` from `@pkgs/kv/kv-platform` (web `localStorage` or React Native `AsyncStorage`). Do **not** back this with `SecureStorage` / `expo-secure-store` — the 2048-byte per-value cap rejects committed-log blobs as soon as a few entries accumulate. None of this data is sensitive (it's a recovery cache).
- **Server storage — `memory`** (`@pkgs/room/server/adapters/memory`): `InMemoryRoomStorage` for tests and the loopback testkit.
- **Server host — `durable-object`** (`@pkgs/room/server/adapters/durable-object`): `createDurableObjectAdapter({ modules: […] })` takes a flat array of `RoomModule` values (each carries a wire-unique `name`). WebSocket upgrades must include query `topic` and `module` (matching one module's `name`). The DO keeps a `Map` of {@link RoomServer} instances (one per module, started on first use); each socket stores `moduleName` so inbound frames route to the right server. Per-socket routing (`connId`, identity, module, topic) is also written via Hibernation WebSocket `serializeAttachment`, and rebuilt from `ctx.getWebSockets()` after DO eviction so idle rooms keep broadcasting to still-connected peers. KV persistence is namespaced per module via {@link DurableObjectRoomStorage} (one key per event / dedup outcome — not a single blob — so long-lived rooms stay under the SQLite 2 MB row cap). Bind via `class_name` in `wrangler.toml`. Host apps typically re-export the result as their `Room` DO class.
- **Testkit** (`@pkgs/room/testkit`): curated re-exports of `openLoopbackRoom`, `LoopbackRoomTransport`, and `TestCounterModule` from `src/tests/harness/` + `src/tests/fixtures/` for in-process convergence tests and playgrounds.

## Deterministic simulation testing (DST)

TigerBeetle-style DST in `src/sim/` (private — not a public export). **One seed →
identical timeline.** Modeled on sync-engine’s five concepts, but room-shaped:
`RoomServer` + networked loopback transports over `createSimIo` (no
`@pkgs/sync-engine` dependency).

```text
seed ──► SeededRng ──► SimRoomNetwork (delay / hold / drop)
  │                         │
  └──► createSimIo ──► clock + timers + delayed deliveries
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         Room clients   networked loopback   RoomServer
         (memory store)                      (memory store)
```

| Concept | API | Notes |
|---------|-----|-------|
| **Time** | `runFor` / `until` / `never` | Virtual clock + net delivery queue; never wall sleeps |
| **Network** | `world.net(clientId).set('hold'\|'down'\|'ok'\|FaultProfile)` | Disposable restore-prior stack |
| **Node** | `world.node(id).disconnect()` / `.reconnect()` | Soft session teardown / reattach; stable client id |
| **Client** | `dispatch`, `snapshot`, `hash`, `isSynced`, `isConnected` | Black-box; no private Room fields |
| **Settle** | `assertConverged()` | Heal nets, drain, assert domain hashes match server fold |

**Connectivity triad (room):**

| API | Layer | Use when |
|-----|-------|----------|
| `client.disconnect()` / `connect()` | Transport session | Offline optimistic dispatch + flush on welcome |
| `world.net(id).set('hold'\|'down')` | Mesh reality | Partition / hold frames without tearing the Room down |

**Not simulated:** real WebSocket, Durable Object hibernation. Keep wallIo
loopback tests (`tests/harness` via `@pkgs/room/testkit`) and DO unit tests as they are.

Failures from `until` / `never` / `assertConverged` embed `seed=<hex>` and
virtual `now=` for replay. Scenarios are `*.sim.test.ts` under
`src/tests/scenarios/` (picked up by root `ci:sim-determinism`).

```bash
bun run --filter @pkgs/room test:sim
```

#### Quick start

```ts
import { describe, expect, test } from 'bun:test';
import {
  Increment,
  TestCounterModule,
  counterValue,
} from '../fixtures/counter-module';
import { openRoomSimWorld } from '../../sim/world';

describe('room sim', () => {
  test('partition then heal', async () => {
    await using world = await openRoomSimWorld({
      seed: 3,
      module: TestCounterModule,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    {
      using _hold = world.net('bob').set('hold');
      a.dispatch(Increment({}));
      await world.never(() => counterValue(b.snapshot()) === 1, {
        forMs: 200,
      });
    }
    await world.assertConverged();
    expect(a.hash()).toBe(b.hash());
  });
});
```

## Tiger Style (this package)

- **Assert on hot paths** where a violation means impossible state (`Assert.crash()` from `@pkgs/assert`), especially after wire parse and seq checks.
- **No bare `catch`**: transport and storage failures propagate to `onError` or explicit disconnect.
- **Fail loudly on bad wire**: unknown `kind` / version mismatch → connection dropped or `rejected`, not silent ignore.

## Security (intended posture)

- **Auth at upgrade**: reject before game frames (401/403).
- **Authorize optional** per topic/command (e.g. space membership).
- **Never trust client-only validation** for integrity or money; server runs `module.handle` on server-held state.
- **Dedup by `commandId`** limits replay amplification; persist outcome where ordering matters.
