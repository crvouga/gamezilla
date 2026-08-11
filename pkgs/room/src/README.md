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
| `@pkgs/room/tests` | Curated re-exports: `openLoopbackRoom`, `openRoomSimWorld`, kit (`runModuleConformance`, …), fixtures (`TestCounterModule`, deadline/authz/match-clock) |

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
├── effects/              Schedule/CancelSchedule + RoomEffectHandler port
├── sim/                  private DST harness (world, net, settle, until)
└── tests/
    ├── fixtures/         TestCounterModule, Deadline/Authz/MatchClock fixtures
    ├── harness/          openLoopbackRoom + LoopbackRoomTransport
    ├── kit/              Module-conformance API + M1–M8 DST
    └── scenarios/        Engine DST *.sim.test.ts (import sim + fixtures)
```

Facade: [`testkit.ts`](./testkit.ts) → package export `@pkgs/room/tests`
(includes `openRoomSimWorld` + kit for game packages; `src/sim/` stays private).

## Core types (design surface)

- **`RoomModuleName`** — branded kebab id for DO routing (`module` query).
- **`RoomModule<S, C, E, Identity>`** — `name`, `initialState`, `handle`, `reduce`, **`hash`**.
- **`RoomCommand`** — `{ id, ts, payload }`; `id` is the server idempotency key.
- **`HandleResult`** — `{ ok: true, events, effects? }` or `{ ok: false, error }`.
- **`RoomEffect`** — Message-shaped side-effect intent (not on the event log).
- **Built-in effects** — `ScheduleEffect` / `CancelScheduleEffect` (`room-effect/*`);
  at epoch `at`, the host injects `payload` as a command with identity
  `room:scheduler`. Server: DO `setAlarm` + KV pending set. Client/sim:
  `io.timers`. Unknown effects with no handler fail loudly.
- **Anti-cheat clocks** — remaining time / deadlines live in **committed events**;
  elapsed uses server `command.ts`. Clients may arm optimistic timers for UX;
  only the server commit decides flag-fall / expire. See
  `MatchClockFixtureModule` + `match-clock-schedule.sim.test.ts` (MC-01..06).
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
| Server | `serverSnapshot()`, `serverHash()` | Storage log fold (authority); use for domain expects |
| Settle | `assertConverged()` | Heal nets, drain; live committed + every client hash == log fold; `seed=` / `now=` |

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
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(1);
    expect(counterValue(a.snapshot())).toBe(1);
    expect(a.hash()).toBe(await world.serverHash());
  });
});
```

Domain expectations after settle must assert the **server fold**
(`serverSnapshot` / `serverHash`) first, then clients. Mid-partition
client-only checks (`never`, lagging peer) stay client-scoped.

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
| `tests/scenarios/single-client-increment.sim.test.ts` | DST E1 | One client increments; settles; domain count/hash matches server |
| `tests/scenarios/two-client-converge.sim.test.ts` | DST E1 | Alice+Bob mutual increments → equal hashes, count=3, roster size 2 |
| `tests/scenarios/partition-then-heal.sim.test.ts` | DST E1 | `net(bob).hold` during Alice write → Bob `never` sees update → heal → converge |
| `tests/scenarios/offline-dispatch-then-sync.sim.test.ts` | DST E1/E6 | Soft disconnect → optimistic increment → peer `never` sees → reconnect → converge |
| `tests/scenarios/seeded-workload-determinism.sim.test.ts` | DST E9 | Same seed (`SIM_SEED`) → identical multi-client hash string twice (incl. mid hold) |
| `tests/scenarios/hold-during-flush.sim.test.ts` | DST E1/E6 | Offline queue + peer hold during flush → heal → converge |
| `tests/scenarios/down-then-heal.sim.test.ts` | DST E1 | `net.down` drops frames; soft cycle + heal → converge |
| `tests/scenarios/down-during-welcome.sim.test.ts` | DST E1/E3 | Join under down; reconnect → converge |
| `tests/scenarios/hold-during-sync.sim.test.ts` | DST E1/E3 | Long hold then release mid catch-up → converge |
| `tests/scenarios/triad-matrix-smoke.sim.test.ts` | DST E1/E6 | Soft disconnect ∩ hold ∩ down remain independent |
| `tests/scenarios/lossy-profile-converge.sim.test.ts` | DST E1/E9 | Mild delay/loss/reorder/dup + soft cycle → converge |
| `tests/scenarios/n-client-partition.sim.test.ts` | DST E1 | Selective holds across ≥4 clients → converge |
| `tests/scenarios/concurrent-increment-burst.sim.test.ts` | DST E1/E5 | Three-client burst under mild faults → count + hashes |
| `tests/scenarios/command-id-replay-dedup.sim.test.ts` | DST E2 | Same `commandId` across take-over storm applies once |
| `tests/scenarios/offline-queues-interleave.sim.test.ts` | DST E5/E6 | Dual offline queues + interim peer commits → server order |
| `tests/scenarios/inc-dec-conflict-order.sim.test.ts` | DST E5 | Inc/dec under jitter → final equals server fold |
| `tests/scenarios/sync-after-long-partition.sim.test.ts` | DST E1/E3 | 20 commits behind hold → catch-up converge |
| `tests/scenarios/stale-welcome-recover.sim.test.ts` | DST E3 | Stale tip welcome inject + soft storms → resync |
| `tests/scenarios/multi-tab-same-identity.sim.test.ts` | DST E7 | Same identity, different `clientId` → equal domain hashes |
| `tests/scenarios/session-takeover-sim.sim.test.ts` | DST E2/E7 | `node.takeOver` mid-command → no double-apply |
| `tests/scenarios/replay-flood-dedup.sim.test.ts` | DST E2 | 50× same `commandId` → single apply |
| `tests/scenarios/malformed-frame-reject.sim.test.ts` | DST E4 | Non-Message / unknown kind → reject or ignore; no mutate |
| `tests/scenarios/authorize-reject.sim.test.ts` | DST E4/E7 | World `authorize` denies → unauthorized; no mutate |
| `tests/scenarios/unknown-command-reject.sim.test.ts` | DST E4 | Unknown message type → invalid-command |
| `tests/scenarios/byzantine-committed-inject.sim.test.ts` | DST E1/E3 | Forged committed → soft cycle restores server truth |
| `tests/scenarios/long-chaos-determinism.sim.test.ts` | DST E1/E9 | ≥3 clients seeded chaos (hold/down/soft) → hash ×2 |
| `tests/scenarios/two-topic-shared-storage.sim.test.ts` | DST H | Shared storage, two topics; A faults leave B alone |
| `tests/scenarios/spectator-fanout-no-domain-perturb.sim.test.ts` | DST E1/H | Extra joiners do not change domain hash |
| `tests/scenarios/asymmetric-link.sim.test.ts` | DST P2 | Directional `toClient` hold vs `toServer` ok |
| `tests/scenarios/match-clock-schedule.sim.test.ts` | DST MC-01..06 | Match-clock Schedule wake; server-first flag anti-cheat |
| `tests/fixtures/counter-module.sim.test.ts` | Module M8 | Pure `TestCounterModule` under `createSimIo` seed-stable |
| `tests/kit/purity-and-seed.sim.test.ts` | Kit M1/M8 | `runModuleConformance` smoke on counter |
| `tests/kit/hash-canonicality.sim.test.ts` | Kit M2 | Hash independent of key insertion order |
| `tests/kit/totality-sweep.sim.test.ts` | Kit M3 | Handle never throws across corpus |
| `tests/kit/fold-closure.sim.test.ts` | Kit M4 | Reduce over ordered log stays valid |
| `tests/kit/authz-survives-reconnect.sim.test.ts` | Kit M5 | Non-owner unauthorized after soft reconnect |
| `tests/kit/terminal-monotonicity.sim.test.ts` | Kit M6 | Schedule Expire wins; late act/expire no-ops |
| `tests/kit/deadline-vs-action.sim.test.ts` | Kit M7 | Lagging client cannot beat engine Schedule expire |
| `tests/kit/engine-fuzz-sequences.sim.test.ts` | Kit E1/M* | Deadline fixture fuzz via real engine |

Game-layer DST (outside this package, still under `ci:sim-determinism`):

| File | Kind | Asserts / use case |
|------|------|--------------------|
| `libs/chess/.../chess-puzzle.conformance.sim.test.ts` | Gp-01 | `ChessModule` via `runModuleConformance` |
| `libs/chess/.../scenarios/host-auth-partition.sim.test.ts` | Gp-02 | Non-host reject under hold; converge |
| `libs/chess/.../scenarios/solved-monotonic.sim.test.ts` | Gp-03 | Post-solved cmds leave terminal hash |
| `libs/chess/.../scenarios/wrong-vs-solved-race.sim.test.ts` | Gp-04 | Two host tabs race → one status |
| `libs/chess/.../scenarios/competition-races.template.sim.test.ts` | Gc template | Skipped stakes races until competition module exists |

Curated exports for games: `@pkgs/room/tests` (`openRoomSimWorld`, kit helpers, fixtures). `src/sim/` remains private implementation.

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
| `server/adapters/durable-object/auth-upgrade.test.ts` | DO host | Missing identity header on upgrade → HTTP 401 |
| `client/adapters/transport/websocket/transport.test.ts` | WS transport | Heartbeat ping; reconnect on missed pong; `probeLiveness`; pong clears miss |
| `client/adapters/storage/key-value/storage.test.ts` | KV storage | Corrupt committed/queued blobs load empty and are zapped |

### Pure helpers

| File | Kind | Asserts / use case |
|------|------|--------------------|
| `hash-room-state.test.ts` | Unit | Canonical JSON key sort; insertion-order-independent FNV hash |
