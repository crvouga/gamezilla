# `@gamezilla/room`

Server-authoritative multiplayer for a **single topic** (e.g. `space:<uuid>`).

The **server** is the only writer to the committed event log. The **client** is optimistic and offline-friendly: it applies commands locally, persists a durable command queue, and replays after reconnect. Convergence is `sync(fromSeq)` plus server dedup by `commandId`.

## Entrypoints

Both the client and server entrypoints expose **core only** — engine + ports. Each adapter is its own subpath import so callers explicitly opt in to a runtime/backend, and swapping adapters is a one-line import change.

| Import                                                | Purpose                                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `@gamezilla/room`                                     | Core client: `Room`, `useRoomSnapshot`, ports (`ClientTransport`, `ClientRoomStorage`), wire helpers |
| `@gamezilla/room/server`                              | Core server: `RoomServer`, `RoomStorage`, `RoomAuth` (no adapters)                                   |
| `@gamezilla/room/client/adapters/transport/websocket` | `WebSocketRoomTransport` (browser/Worker `WebSocket`)                                                |
| `@gamezilla/room/client/adapters/storage/memory`      | `InMemoryClientStorage` (tests)                                                                      |
| `@gamezilla/room/client/adapters/storage/web`         | `WebClientStorage` (synchronous `localStorage`)                                                      |
| `@gamezilla/room/client/adapters/storage/key-value`   | `KeyValueClientRoomStorage` (async KV — `localStorage` web, AsyncStorage native)                     |
| `@gamezilla/room/server/adapters/durable-object`      | `createDurableObjectAdapter`, `DurableObjectRoomStorage`, DO type stubs                              |
| `@gamezilla/room/server/adapters/memory`              | `InMemoryRoomStorage` (tests / loopback testkit)                                                     |
| `@gamezilla/room/testkit`                             | `openLoopbackRoom`, `LoopbackRoomTransport`, `TestCounterModule`                                     |

The folder layout mirrors the entrypoint layout:

```
libs/room/src/
├── client/
│   ├── core/                               (Room engine, hook, ports)
│   └── adapters/
│       ├── storage/{memory,web,key-value}/ (ClientRoomStorage impls)
│       └── transport/websocket/            (ClientTransport impl)
└── server/
    ├── core/                               (RoomServer, ports)
    └── adapters/{durable-object,memory}/   (RoomStorage impls + DO host)
```

A new runtime (Node HTTP server, Postgres-backed storage, WebRTC transport, etc.) is a new folder under the matching `adapters/…` slot plus one entry in `package.json#exports` — the core engines stay untouched.

## Core types

- **`RoomModule<S, C, E, Identity>`** — `initialState`, `handle(state, command, identity)`, `reduce(state, event)`.
- **`RoomCommand<C>`** — `{ id, ts, payload }` (client generates `id`; server treats it as idempotency key).
- **`HandleResult<E>`** — `{ ok: true, events }` or `{ ok: false, error: RoomError }`.
- **`RoomError`** — small union: `invalid_command`, `unauthorized`, `conflict`, `rate_limited`, `internal`.

## Wire protocol

Versioned JSON frames (`wireVersion` on envelopes). Client → server: `command`, `sync`, `ping`. Server → client: `welcome`, `committed`, `rejected`. Each committed event has a monotonic **`seq`** per topic.

## Ports (inject, do not singleton)

- **`ClientTransport`** — connect, send JSON, subscribe to inbound, lifecycle hooks (`onHandlers`).
- **`ClientRoomStorage`** — durable committed tail + queued commands (`appendQueued`, `removeQueued`, `loadQueued`, `saveCommitted`, `loadCommitted`).
- **`RoomStorage` (server)** — append/load log, `nextSeq`, command dedup (`seenCommandId`, `recordCommandId`).
- **`RoomAuth`** — authenticate WebSocket upgrade; optional `authorize` per command.

## Shipped adapters

- **Client transport — `websocket`** (`@gamezilla/room/client/adapters/transport/websocket`): `WebSocketRoomTransport` with exponential backoff reconnect.
- **Client storage — `memory`** (`@gamezilla/room/client/adapters/storage/memory`): `InMemoryClientStorage` for tests and the loopback testkit.
- **Client storage — `web`** (`@gamezilla/room/client/adapters/storage/web`): `WebClientStorage` for synchronous `localStorage`.
- **Client storage — `key-value`** (`@gamezilla/room/client/adapters/storage/key-value`): `KeyValueClientRoomStorage` for async `KeyValueStorage` (web `localStorage` or React Native `AsyncStorage`). Do **not** back this with `SecureStorage` / `expo-secure-store` — the 2048-byte per-value cap rejects committed-log blobs as soon as a few entries accumulate. None of this data is sensitive (it's a recovery cache).
- **Server storage — `memory`** (`@gamezilla/room/server/adapters/memory`): `InMemoryRoomStorage` for tests and the loopback testkit.
- **Server host — `durable-object`** (`@gamezilla/room/server/adapters/durable-object`): `createDurableObjectAdapter({ module })` returns a Cloudflare Workers DO class wired to `RoomServer` + the KV-backed `DurableObjectRoomStorage`. Bind via `class_name` in `wrangler.toml`; one adapter per domain module. Used in production (see `apps/api/src/rooms/space-do.ts`).
- **Testkit** (`@gamezilla/room/testkit`): `openLoopbackRoom`, `LoopbackRoomTransport`, `TestCounterModule` for in-process convergence tests.

## Tiger Style (this package)

- **Assert on hot paths** where a violation means impossible state (`Assert.crash()` from `@gamezilla/lib/assert`), especially after wire parse and seq checks.
- **No bare `catch`**: transport and storage failures propagate to `onError` or explicit disconnect.
- **Fail loudly on bad wire**: unknown `kind` / version mismatch → connection dropped or `rejected`, not silent ignore.

## Security (intended posture)

- **Auth at upgrade**: reject before game frames (401/403).
- **Authorize optional** per topic/command (e.g. space membership).
- **Never trust client-only validation** for integrity or money; server runs `module.handle` on server-held state.
- **Dedup by `commandId`** limits replay amplification; persist outcome where ordering matters.
