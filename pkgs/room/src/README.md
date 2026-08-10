# `@pkgs/room`

Server-authoritative multiplayer for a **single topic** (e.g. `space:<uuid>`).

This package is the realtime session engine used by product features (primarily
`@libs/spaces` + game `RoomModule`s). It is **not** the app sync engine
(`@pkgs/sync-engine`): room is a lower-level `pkgs` leaf with its own wire
protocol, optimistic client queue, and Durable Object host.

## Why it exists

| Need | How room solves it |
|------|--------------------|
| Shared live game / lobby state | One authoritative event log per topic; clients fold the same events |
| Snappy UX under latency / offline | Client applies commands optimistically, queues durable outbound, flushes after welcome |
| Multi-device / multi-tab | Roster keyed by `(identity, clientId)`; session take-over on reconnect |
| Cloudflare hosting | DO adapter multiplexes modules, hibernates sockets, persists per-key log |
| Deterministic regression | Private DST harness (`src/sim/`) — one seed → identical timeline |

**Out of scope:** cross-topic SQL sync, auth sessions, REST CRUD, Sim Lab GUI.

## Mental model

```text
┌──────────── client ────────────┐         ┌──────── server (RoomServer) ────────┐
│ Room.open + ClientTransport    │  wire   │ authenticate / authorize            │
│ optimistic fold + command queue│◄───────►│ append events (seq), dedup commandId│
│ ClientRoomStorage (local cache)│         │ RoomStorage (committed log)         │
│ display = committed ⊕ queued   │         │ broadcast welcome / committed       │
└────────────────────────────────┘         └─────────────────────────────────────┘
```

Convergence rule: after reconnect, `sync(fromSeq)` + server dedup by `commandId`
brings every synced client’s **domain** fold (module `hash`, meta stripped) in
line with the server fold.

**Required on every `RoomModule`:** `hash(state)` — deterministic domain hash
(see root [`DETERMINISM.md`](../../../DETERMINISM.md)). Used by DST settle and
by game modules in product.

## Product use cases (callers)

1. **Space / game sessions** — `@libs/spaces` opens a WebSocket room per space,
   injects composed game modules, reads `useRoomSnapshot` / selectors.
2. **Offline-first open** — `Room.open` hydrates local storage and attaches
   transport even when connect fails; UI can dispatch while disconnected.
3. **Playgrounds / widgets** — `@pkgs/room-widgets` and tests use
   `@pkgs/room/tests` (`openLoopbackRoom`, `TestCounterModule`) for in-process
   multi-client demos without a Worker.
4. **Authoring a game** — implement `RoomModule` (`initialState` / `handle` /
   `reduce` / `hash`), register in spaces’ module list + DO `modules: […]`.

## Entrypoints

Core vs adapters stay split so callers opt into a runtime explicitly.

| Import | Purpose |
|--------|---------|
| `@pkgs/room` | Client core: `Room`, `RoomMetaAttr`, React hooks/registry, ports, wire helpers |
| `@pkgs/room/server` | `RoomServer`, `RoomStorage`, `RoomAuth` |
| `@pkgs/room/client/adapters/transport/websocket` | `WebSocketRoomTransport` (+ heartbeat / `probeLiveness`) |
| `@pkgs/room/client/adapters/storage/memory` | `InMemoryClientStorage` |
| `@pkgs/room/client/adapters/storage/web` | `WebClientStorage` (`localStorage`) |
| `@pkgs/room/client/adapters/storage/key-value` | `KeyValueClientRoomStorage` (async `Kv`) |
| `@pkgs/room/server/adapters/memory` | `InMemoryRoomStorage` |
| `@pkgs/room/server/adapters/durable-object` | `createDurableObjectAdapter`, DO storage |
| `@pkgs/room/tests` | Curated re-exports from `src/tests/` (`openLoopbackRoom`, `LoopbackRoomTransport`, `TestCounterModule`) |

`src/sim/` is **private** (not exported). DST scenarios import it relatively.

## Layout

```text
pkgs/room/src/
├── client/core/          Room engine, fold, meta, ports
├── client/adapters/      websocket transport; memory/web/key-value storage
├── client/react/         snapshot + registry hooks
├── server/core/          RoomServer, auth/storage ports
├── server/adapters/      memory + durable-object host
├── protocol/             wire frames + ids
├── sim/                  private DST harness (world, net, settle, until)
└── tests/
    ├── fixtures/         TestCounterModule (+ module hash sim test)
    ├── harness/          openLoopbackRoom + LoopbackRoomTransport
    └── scenarios/        DST *.sim.test.ts (import sim + fixtures)
```

Facade: [`tests.ts`](./tests.ts) → package export `@pkgs/room/tests`.

## Core types (design surface)

- **`RoomModuleName`** — branded kebab id for DO routing (`module` query).
- **`RoomModule<S, C, E, Identity>`** — `name`, `initialState`, `handle`, `reduce`, **`hash`**.
- **`RoomCommand`** — `{ id, ts, payload }`; `id` is the server idempotency key.
- **`HandleResult`** — `{ ok: true, events }` or `{ ok: false, error }`.
- **`RoomError`** — `ROOM_ERROR_TYPE.*` (`invalid-command`, `unauthorized`, …).
- **State** — flat attribute map; domain keys + `room/*` meta (`RoomMetaAttr`).

## Wire protocol

Versioned JSON (`v`). Kinds in `ROOM_WIRE_KIND`:

- Client → server: `command`, `sync`, `ping`
- Server → client: `welcome`, `committed`, `rejected`

Committed events carry monotonic **`seq`** per topic.

## Ports (inject; no singletons)

| Port | Role |
|------|------|
| `ClientTransport` | connect / sendJson / subscribe / lifecycle handlers |
| `ClientRoomStorage` | committed tail + queued commands |
| `RoomStorage` | append/load log, `nextSeq`, command dedup |
| `RoomAuth` | upgrade auth; optional per-command `authorize` |
| `Io` (`clock` / `timers` / `createId`) | all nondeterministic I/O — no bare wall clocks in product/sim |

## Testing strategy (pick the right tool)

| Tool | When to use |
|------|-------------|
| **`openLoopbackRoom`** (`tests/harness`, via `@pkgs/room/tests`) | Fast in-process unit/integration with `wallIo` or injected `Io`; real `Room` + `RoomServer`, no net faults |
| **`openRoomSimWorld`** (`sim/world`, private) | Multi-client DST: partitions, delays, soft disconnect, hash converge, seed replay |
| **DO / adapter tests** | Hibernation, session take-over, per-key storage, WS heartbeat |

Scripts:

```bash
bun run --filter @pkgs/room test       # all package tests
bun run --filter @pkgs/room test:sim   # DST scenarios only
bun run ci:sim-determinism             # every *.sim.test.ts ×2 same seed
```

### DST five concepts (room-shaped)

| Concept | API | Notes |
|---------|-----|-------|
| Time | `runFor` / `until` / `never` | Virtual clock + net queue; no wall sleeps |
| Network | `world.net(id).set('hold'\|'down'\|'ok'\|FaultProfile)` | Disposable restore-prior stack |
| Node | `world.node(id).disconnect()` / `.reconnect()` | Soft session; stable client id |
| Client | `dispatch`, `snapshot`, `hash`, `isSynced`, `isConnected` | Black-box |
| Settle | `assertConverged()` | Heal nets, drain, domain hash == server fold; errors include `seed=` / `now=` |

Connectivity triad — do not conflate:

1. `client.disconnect()` / `connect()` — transport session (offline optimistic queue)
2. `world.net(id).set('hold'|'down')` — mesh reality (frames not delivered)
3. Offline dispatch while disconnected — Room feature; scenarios prove flush on welcome

**Not simulated:** real WebSocket, DO hibernation runtime (covered by DO unit tests).

### Quick start (DST)

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

## Design constraints (for contributors / agents)

- No `@pkgs/sync-engine` dependency (room stays a leaf).
- No bare wall I/O in sim or product paths — inject `Io` / `createSimIo`.
- Tiger size caps (`biome.json`) — split helpers; no size-rule ignores.
- Domain hard-delete rules belong to sync-engine SQL; room uses event fold only.
- Prefer extending `tests/scenarios/*.sim.test.ts` for multi-client / partition /
  offline regressions before adding wall sleeps to loopback tests.

## Tiger Style

- Assert on hot paths where violation means impossible state.
- No bare `catch` — surface via `onError` or disconnect.
- Fail loudly on bad wire (unknown `kind` / version).

## Security posture

- Auth at upgrade (401/403 before game frames).
- Optional authorize per topic/command.
- Never trust client-only validation for integrity; server runs `module.handle`.
- Dedup by `commandId` limits replay amplification.

---

## Scenario / test catalog

Complete inventory of what this package currently proves. Prefer adding rows
here when you add coverage. Paths are under `pkgs/room/src/`.

### Deterministic simulation (`*.sim.test.ts` — `ci:sim-determinism`)

| File | Kind | Asserts / use case |
|------|------|--------------------|
| `tests/scenarios/single-client-increment.sim.test.ts` | DST | One client increments; settles; domain count/hash matches server |
| `tests/scenarios/two-client-converge.sim.test.ts` | DST | Alice+Bob mutual increments → equal hashes, count=3, roster size 2 |
| `tests/scenarios/partition-then-heal.sim.test.ts` | DST | `net(bob).hold` during Alice write → Bob `never` sees update → heal → converge |
| `tests/scenarios/offline-dispatch-then-sync.sim.test.ts` | DST | Soft disconnect → optimistic increment → peer `never` sees → reconnect → converge |
| `tests/scenarios/seeded-workload-determinism.sim.test.ts` | DST | Same seed (`SIM_SEED`) → identical multi-client hash string twice (incl. mid hold) |
| `tests/fixtures/counter-module.sim.test.ts` | Module DST | Pure `TestCounterModule` handle/reduce/hash under `createSimIo` is seed-stable |

### Loopback / client core

| File | Kind | Asserts / use case |
|------|------|--------------------|
| `room.test.ts` | Loopback | Welcome + increment converges; unknown command rejected locally |
| `room-roster.test.ts` | Loopback | Roster grow/shrink; multi-tab same actor; actor+ts stamped on log |
| `client/core/room-offline-dispatch.test.ts` | Offline fake transport | `Room.open` survives connect throw; optimistic queue while disconnected |
| `client/core/room-server-reset.test.ts` | Loopback / reset | Ignore duplicate committed ≤ tip; recover short/stale welcome; idempotent re-welcome |

### Server core

| File | Kind | Asserts / use case |
|------|------|--------------------|
| `server/core/room-server-envelope.test.ts` | Unit | Non-Message command payload → `rejected` / invalid-command |
| `server/core/room-server-welcome.test.ts` | Unit | Welcome `lastSeq` matches log tail even if storage tip read is wrong |

### Adapters (DO + client)

| File | Kind | Asserts / use case |
|------|------|--------------------|
| `server/adapters/durable-object/storage.test.ts` | DO storage | Per-key append/load; dedup keys; v2→v3 blob migrate; reject seq gaps |
| `server/adapters/durable-object/hibernation.test.ts` | DO host | After simulated eviction, passive peer still receives committed |
| `server/adapters/durable-object/session-takeover.test.ts` | DO host | Same `(identity, clientId)` replaces socket; different `clientId` keeps both |
| `client/adapters/transport/websocket/transport.test.ts` | WS transport | Heartbeat ping; reconnect on missed pong; `probeLiveness`; pong clears miss |
| `client/adapters/storage/key-value/storage.test.ts` | KV storage | Corrupt committed/queued blobs load empty and are zapped |

### Pure helpers

| File | Kind | Asserts / use case |
|------|------|--------------------|
| `hash-room-state.test.ts` | Unit | Canonical JSON key sort; insertion-order-independent FNV hash |
