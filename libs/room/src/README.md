# `@gamezilla/room`

Server-authoritative multiplayer for a **single topic** (e.g. `space:<uuid>`).

The **server** is the only writer to the committed event log. The **client** is optimistic and offline-friendly: it applies commands locally, persists a durable command queue, and replays after reconnect. Convergence is `sync(fromSeq)` plus server dedup by `commandId`.

## Entrypoints

| Import                    | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `@gamezilla/room`         | `Room`, wire parse helpers, client transports/storage, testkit exports   |
| `@gamezilla/room/server`  | `RoomServer`, `RoomStorage`, `RoomAuth`, in-memory storage               |

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

- **Client**: `WebSocketRoomTransport` (browser `WebSocket`), `InMemoryClientStorage`, `WebClientStorage` / `SecureClientRoomStorage` (secure storage backend).
- **Server**: `InMemoryRoomStorage` (tests). Production API uses a **Durable Object** implementation of `RoomStorage` plus hibernating WebSockets (see `apps/api/src/rooms/`).
- **Testkit**: `openLoopbackRoom`, `LoopbackRoomTransport`, `TestCounterModule` for in-process convergence tests.

## Tiger Style (this package)

- **Assert on hot paths** where a violation means impossible state (`Assert.crash()` from `@gamezilla/lib/assert`), especially after wire parse and seq checks.
- **No bare `catch`**: transport and storage failures propagate to `onError` or explicit disconnect.
- **Fail loudly on bad wire**: unknown `kind` / version mismatch → connection dropped or `rejected`, not silent ignore.

## Security (intended posture)

- **Auth at upgrade**: reject before game frames (401/403).
- **Authorize optional** per topic/command (e.g. space membership).
- **Never trust client-only validation** for integrity or money; server runs `module.handle` on server-held state.
- **Dedup by `commandId`** limits replay amplification; persist outcome where ordering matters.
