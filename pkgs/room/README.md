# `@pkgs/room`

Server-authoritative multiplayer for a **single topic** (e.g. `space:<uuid>`).

This package is the realtime session engine used by product features (primarily
`@libs/spaces` + game `RoomModule`s). It is **not** the app sync engine
(`@pkgs/sync-engine`): room is a lower-level `pkgs` leaf with its own wire
protocol, optimistic client queue, Durable Object host, and effect/schedule
runtime for time-sensitive rules (clocks, deadlines).

Use this README as the design surface when giving feedback or extending the
package. Prefer scenarios + fixtures over speculation about “how room works.”

---

## Why it exists

| Need | How room solves it |
|------|--------------------|
| Shared live game / lobby state | One authoritative event log per topic; clients fold the same events |
| Snappy UX under latency / offline | Client applies commands optimistically, queues durable outbound, flushes after welcome |
| Multi-device / multi-tab | Roster keyed by `(identity, clientId)`; session take-over on reconnect |
| Time-sensitive rules (flag / deadline) | Modules emit `Schedule` effects; server wake injects commands; clients may arm optimistic timers |
| Cloudflare hosting | DO adapter multiplexes modules, hibernates sockets, persists per-key log + pending schedules |
| Deterministic regression | Harness harness (`@pkgs/room-harness`) — one seed → identical timeline |

**Out of scope:** cross-topic SQL sync, auth sessions, REST CRUD,
bandwidth/clock-drift compensation beyond server `command.ts`, broadcasting
effects on the wire, real chess competition UI clocks.

---

## Performance model

The engine is built for mouse-movement-rate traffic on Durable Objects and
low-end phones. Every steady-state step is **O(what changed)**, never O(log)
or O(queue):

| Hot path | Cost | How |
|----------|------|-----|
| `dispatch` | 1 `handle` + O(events) `reduce` + 1 notify + 1 send | `display` (= committed ⊕ optimistic) is maintained incrementally; no refold per read |
| Own-command echo (`committed` with our `commandId` at the queue head) | O(events) | Committed events are compared structurally with the optimistic prediction; when equal the rebase is skipped and the snapshot **reference is unchanged** (Solid does no work) |
| Foreign `committed` | O(pending queue) re-`handle` | Inherent optimistic rebase; nothing else is touched |
| Persistence | write-behind, coalesced | `ClientRoomStorage.appendCommitted` appends only the new entries; the outbound queue is persisted as a snapshot (ghost rows are impossible by construction) |
| `getLog()` | O(log) **only when read after a change** | Copy-on-read; the internal log is appended in place |
| Server commit | 1 dedup read + 2 writes | Tip is cached after hydrate; no `getLastSeq` per command |
| Server broadcast | 1 `JSON.stringify` per frame | One frame object fans out to every socket; the DO adapter memoizes its JSON per object |
| `hashRoomState` | sorted-copy + native stringify + FNV-1a on 32-bit limbs | No `BigInt`, no dictionary-mode objects |

Dev builds additionally validate state keys once per **new key** (cached
`Set`), not per reduce; production builds skip the check (hot asserts).

What stays inherent: a fresh joiner still replays the committed log from
`fromSeq` in 512-entry welcome pages, and the client keeps the full log in
memory / local storage for `getLog()` (segmented on disk, so appends stay
bounded). Rooms that log every cursor move grow without bound; snapshot /
compaction or an unlogged presence channel would be a protocol addition, not
an engine optimization.

Measure with `bun run --filter @pkgs/room bench` (`tests/bench/hot-paths.bench.ts`).
To compare against a previous engine, snapshot it and point `ROOM_OLD_SRC` at
its `src` (default `<repo>/.bench-old-room/src`):

```bash
mkdir -p .bench-old-room && git archive <sha> pkgs/room/src | tar -x -C .bench-old-room --strip-components=2
bun run --filter @pkgs/room bench
```

---

## Mental model

```text
┌──────────── client ────────────┐         ┌──────── server (RoomServer) ────────┐
│ RoomClient.open + ClientTransport    │  wire   │ authenticate / authorize            │
│ incremental display + queue    │◄───────►│ append events (seq), dedup commandId│
│ ClientRoomStorage (write-behind)│        │ RoomStorage (committed log)         │
│ display = committed ⊕ queued   │         │ broadcast one frame / committed     │
│ optional effectHandlers        │         │ effectHandlers after successful ok  │
│  (io.timers Schedule)          │         │  (DO alarm / harness timers Schedule)   │
└────────────────────────────────┘         └─────────────────────────────────────┘
```

**Convergence rule:** after reconnect, `sync(fromSeq)` + server dedup by
`commandId` brings every synced client’s **domain** fold (module `hash`,
`room/*` meta stripped) in line with the server fold.

**Authority rule for domain expects in tests:** assert
`serverSnapshot()` / `serverHash()` first, then clients. Mid-partition
client-only checks (`never`, lagging peer) stay client-scoped.

**Required on every `RoomModule`:** `hash(state)` — deterministic domain hash
(see [`docs/DETERMINISM.md`](../../docs/DETERMINISM.md)). Used by harness settle and
by game modules in product.

---

## Product use cases (callers)

1. **Space / game sessions** — `@libs/spaces` opens a WebSocket room per space,
   injects composed game modules, reads `useRoomSnapshot` / selectors.
2. **Offline-first open** — `RoomClient.open` hydrates local storage and attaches
   transport even when connect fails; UI can dispatch while disconnected.
3. **Simulators / widgets** — `@pkgs/room-widgets` and tests use
   `@pkgs/room-harness` (`openLoopbackRoom`, `TestCounterModule`) for in-process
   multi-client demos without a Worker.
4. **Authoring a game** — implement `RoomModule` (`initialState` / `handle` /
   `reduce` / `hash`), optionally emit `Schedule` / `CancelSchedule` effects for
   clocks; register in spaces’ module list + DO `modules: […]`.
5. **Module conformance** — games call `runModuleConformance` from
   `@pkgs/room-harness` (hash / totality / fold / fuzz / optional deadline hooks).

---

## Entrypoints

Core vs adapters stay split so callers opt into a runtime explicitly.

| Import | Purpose |
|--------|---------|
| `@pkgs/room` | Client core: `RoomClient`, `RoomMetaAttr`, Solid hooks/registry, ports, wire helpers, effect builtins / handlers |
| `@pkgs/room/server` | `RoomServer`, `RoomStorage`, `RoomAuth`, effect types/builtins |
| `@pkgs/room/client/adapters/storage/key-value` | `KeyValueClientRoomStorage` (async `Kv`) |
| `@pkgs/room-adapter-web` | `WebSocketRoomTransport` (+ heartbeat / `probeLiveness`), `WebClientStorage` (`localStorage`) |
| `@pkgs/room-adapter-memory` | `InMemoryRoomStorage`, `InMemoryClientStorage`, `LoopbackRoomTransport` |
| `@pkgs/room-adapter-durable-object` | `createDurableObjectAdapter`, DO storage + alarm schedule |
| `@pkgs/room-harness` | `openLoopbackRoom`, **`bootRoomHarness` / `roomSystemCatalog` / `roomVirtual`**, kit (`runModuleConformance`, …), fixtures (counter / deadline / authz / match-clock) |

Each adapter is its own package so callers pull in only the runtime they
host on. Games should declare their own `defineSystem` from `@pkgs/harness` over
`bootRoomHarness` / `roomVirtual` / `roomSystemCatalog` (`@pkgs/room-harness`)
and drive runs with `system.run` / `.explore` / `.replay`, not deep relative
`harness/` paths.

---

## Layout

```text
pkgs/room/
├── src/
│   ├── client/core/          RoomClient + core bookkeeping (`room-client-core`),
│   │                         wire appliers, write-behind persist, snapshot cache,
│   │                         meta, ports, optimistic effects
│   ├── client/storage/       segmented committed-log codec (shared by adapters)
│   ├── client/adapters/      key-value storage (async `Kv`, segmented)
│   ├── client/solid/         snapshot + registry hooks
│   ├── server/core/          RoomServer (one storage serial, cached tip), fan-out, ports
│   ├── protocol/             wire frames + ids
│   ├── effects/              Schedule/CancelSchedule + RoomEffectHandler port
│   ├── hash-room-state.ts    canonical JSON + FNV-1a (32-bit limbs)
│   └── plain-deep-equal.ts   structural equality for the ack fast path
└── tests/                    black-box against package exports (+ `bench/`)

pkgs/room-adapter-web/            websocket transport + localStorage storage
pkgs/room-adapter-memory/         in-memory room/client storage + loopback transport
pkgs/room-adapter-durable-object/ DO adapter (alarms, KV schedules)
pkgs/room-harness/                    harness harness (`@pkgs/room-harness`)
└── src/scenario/                 boot + actions / properties / S
```

---

## Core types (design surface)

- **`RoomModuleName`** — branded kebab id for DO routing (`module` query).
- **`RoomModule<S, C, E, Identity>`** — `name`, `initialState`, `handle`, `reduce`, **`hash`**.
- **`RoomCommand`** — `{ id, ts, payload }`; `id` is the server idempotency key;
  `ts` is commit/display time (server stamps on inject; client mints on dispatch).
- **`HandleResult`** — `{ ok: true, events, effects? }` or `{ ok: false, error }`.
  Existing `{ ok: true, events }` callers remain valid (`effects` optional).
- **`RoomEffect`** — Message-shaped side-effect intent (**not** on the event log).
- **`RoomError`** — `ROOM_ERROR_TYPE.*` (`invalid-command`, `unauthorized`,
  `conflict`, `rate-limited`, `internal`).
- **State** — flat attribute map; domain keys + `room/*` meta (`RoomMetaAttr`).
  Domain keys must be namespaced Keywords; `room/*` is reserved for client meta.

### Message envelopes

Commands, events, and effects are `@pkgs/message` envelopes
(`isMessageEnvelope`). Prefer `createMessageNamespace('<prefix>')` in modules
(e.g. `deadline-cmd/start`, `room-effect/schedule`).

---

## Effects + schedules (clocks / deadlines)

### Model

```ts
type RoomEffect = Message;

type HandleResult =
  | { ok: true; events: E[]; effects?: readonly RoomEffect[] }
  | { ok: false; error: RoomError };
```

Built-ins (`createMessageNamespace('room-effect')`):

| Effect | Payload | Meaning |
|--------|---------|---------|
| `ScheduleEffect` | `{ id, at, payload }` | At epoch `at`, inject `payload` as a command |
| `CancelScheduleEffect` | `{ id }` | Drop pending schedule with that id |

- `id` is the module-chosen schedule key (e.g. `match-clock:flag`, `deadline:expire`).
- Fire uses identity **`room:scheduler`** (`ROOM_SCHEDULER_IDENTITY`).
- Effects run **after** successful commit (server) or optimistic apply (client).
  Rejected handles produce no effects.
- Effects are **not** broadcast on the wire. Clients derive schedules from local
  optimistic `handle` and/or re-derive from committed events in product code.

### Handlers

```ts
type RoomEffectHandler = {
  apply(effect, ctx): boolean | Promise<boolean>; // true = claimed
};
```

- Compose: first handler that returns `true` wins.
- No claim → Tiger throw (`Tiger: no RoomEffectHandler for effect type=…`).
- Config: `RoomServerConfig.effectHandlers?`, `RoomClientConfig.effectHandlers?`.
- DO adapter always installs the persisting Schedule handler; accepts extras.
- Harness / loopback install timer-backed Schedule stacks via `createTimerScheduleStack`.

### Schedule runtime

Shared `ScheduleRuntime` (`effects/schedule-runtime.ts`):

1. Map `id → { at, payload }` (upsert / cancel).
2. Arm wake to **earliest** pending `at`.
3. On fire: remove due entries, `injectCommand` with minted `commandId`,
   `ts = clock.now()`, identity `room:scheduler`.
4. Re-arm next earliest.
5. Persistence: DO KV under `room.do.v3.<module>.s.<id>`; memory for harness/client.

Helper stacks:

- `createTimerScheduleStack` — `io.timers` wake (client + harness + loopback).
- `openDoModuleSchedule` / `DoAlarmHub` — DO `setAlarm` + KV sync.

### Where wakes land

| Runtime | Wake | Inject path |
|------|------|-------------|
| Cloudflare DO | `storage.setAlarm` → `alarm()` | `RoomServer.injectCommand` |
| Harness / loopback server | `io.timers` (+ harness `serverQueue`) | `RoomServer.injectCommand` |
| Client optimistic | `io.timers` | `RoomClient.dispatch(payload)` (local UX) |

Server inject is socket-less: dedup by `commandId`, authorize, `handle`, commit,
broadcast, then apply nested effects. Actor metadata uses
`clientId: 'scheduler'`.

### Anti-cheat invariants (module + engine)

1. Remaining time / deadline lives in **committed events**, not client trust.
2. Elapsed time uses **server `command.ts`** (commit clock), never client wall.
3. Lagging client cannot gain time: late move after deadline → reject; only
   scheduled `FlagFall` / `Expire` terminates the race.
4. Client early `FlagFall` before `at` → module `conflict`; server alarm still
   fires once at the true `at`.
5. Cancel + reschedule on move so only the active seat’s flag is armed.

Reference fixtures: `DeadlineFixtureModule` (Schedule → `Expire`),
`MatchClockFixtureModule` (dual banks + `FlagFall`). Scenarios: kit M6/M7,
`specs/rooms/match-clock.feature` and the
`specs/rooms/match-clock.qnt` model.

```mermaid
flowchart LR
  handle[module.handle] --> ok["ok events + effects"]
  ok --> commit[append log + reduce + broadcast]
  commit --> applyFx[applyRoomEffects]
  applyFx --> sched[Schedule handler]
  sched --> doAlarm[DO setAlarm + KV]
  sched --> clientTimer[io.timers.setTimeout]
  doAlarm --> wake[alarm / timer fire]
  wake --> inject["injectCommand as room:scheduler"]
  inject --> handle
```

---

## Wire protocol

Versioned JSON (`v`). Kinds in `ROOM_WIRE_KIND`:

- Client → server: `command`, `sync`, `ping`
- Server → client: `welcome`, `committed`, `rejected`, `roster`, `pong`

Committed events carry monotonic **`seq`** per topic. Dedup outcomes are stored
per `commandId` (`committed` with entries, or `rejected` with error) so reconnect
replays are idempotent.

---

## Ports (inject; no singletons)

| Port | Role |
|------|------|
| `ClientTransport` | connect / sendJson / subscribe / lifecycle handlers |
| `ClientRoomStorage` | `loadCommitted` / `appendCommitted` / `resetCommitted` + `loadQueued` / `saveQueued` (queue snapshot). Every call is O(what changed); adapters use `createSegmentedCommittedLog` over a `CommittedLogBlobs` port |
| `RoomStorage` | append/load log, lastSeq, command dedup |
| `RoomAuth` | upgrade auth; optional per-command `authorize` |
| `RoomEffectHandler[]` | post-ok side effects (Schedule, custom) |
| `Io` (`clock` / `timers` / `createId`) | all nondeterministic I/O — no bare wall clocks in apps/product/src/harness |

---

## Durable Object adapter notes

- One DO class hosts one or more `RoomModule`s; client picks via `module` query.
- Topic comes from `topic` query; gateway should key DO id by topic.
- Persistence: per-event / per-dedup keys (`room.do.v3.*`); legacy v2 blob migrates.
- Schedules: KV `…s.<id>`, topic key for alarm wake without sockets, `alarm()`
  recreates servers if needed after eviction.
- Hibernation: socket attachment restores routing; `blockConcurrencyWhile` on boot.
- Session take-over: same `(identity, clientId)` replaces prior socket (close 4000).

---

## Testing strategy (pick the right tool)

| Tool | When to use |
|------|-------------|
| **`openLoopbackRoom`** (`@pkgs/room-harness`) | Fast in-process unit/integration with injected `Io`; real `RoomClient` + `RoomServer`, no net faults; Schedule via timers |
| **`system.run`** (`@pkgs/harness`) | Room virtual runtime → `Run<RoomHarness>` driven by `apply` / `read` / `until`: partitions, delays, soft disconnect, crash/restart, hash converge, Schedule wakes |
| **`system.explore` / `s.randomActions`** | Weighted walk over the registered pool (or an `actions:` slice) + shrink; seeded `s.randomActions` for determinism / long workloads |
| **DO / adapter tests** | Hibernation, session take-over, per-key storage, alarms, WS heartbeat |
| **`runModuleConformance`** | Game-module kit (purity, hash, totality, fold, fuzz) |

Scripts:

```bash
bun run --filter @pkgs/room test       # all package tests
bun run --filter @pkgs/room-harness test  # system scenarios + kit only
bun run test:pbt:random                # hunt beyond the pinned seed (not the gate)
```

### Shrinking system kernel (`@pkgs/room-harness` `src/scenario/`)

Runs and action replay are owned by `@pkgs/harness`. A room app declares its own
`defineSystem`, boots `S` with `bootRoomHarness`, and spreads `roomSystemCatalog`
for the virtual runtime, shared library + domain action pool, and standing
properties:

```ts
// tests/apps/counter/system.ts
export const counterSystem = defineSystem<RoomHarness, RoomArgs>({
  name: 'room.counter',
  args: ROOM_ARGS,
  sample: ROOM_DRAW,
  create: (session, args) => bootRoomHarness(session, counterApp, args),
  ...roomSystemCatalog(counterApp),
});

// shrinking PBT — script + weighted walk + shrink
await counterSystem.explore({ episodes: 12, steps: 14 });

// focused slice PBT — only these registered actions are walked
await counterSystem.explore({
  seed: 31,
  episodes: 8,
  steps: 14,
  actions: ['hold', 'down', 'release', 'domain', 'restoreNetwork'],
});

// scripted pin
await using s = await counterSystem.run({
  seed,
  args: { clientCount: 2 },
});
await s.apply(pauseNetwork, 'c0');
await s.apply(domain, domainOp('c0', 'increment'));
await s.apply(resumeNetwork, 'c0');
await expectInSync(s);
```

1. Every library action (`hold`, `down`, `crash`, `armCrashAt`, `injectToServer`,
   …) is a pool action with its own `sample`; `app.domainOpArbs` feeds `domain`
2. Const fault catalogs (`NET_FAULT_PROFILES`, `MALFORMED_MESSAGE_INJECT_KINDS`,
   crash events) are drawn by the pool actions and exhausted by slice PBTs via
   `explore({ actions: [...] })`
3. Determinism / long workloads: `s.randomActions({ steps, time })` twice with the same
   seed must yield identical `choices` and inSync hashes

On find: `explore` returns a shrunk `Recording`; replay it with
`counterSystem.replay(repro)` → pin in `room-system.scenario.pbt.test.ts` or a
named example test marked `// regression: <id>` → register it in
[`known-bugs.json`](../../libs/tools/goal/known-bugs.json) ([`docs/TESTING.md`](../../docs/TESTING.md) § 3).

### System five concepts (room-shaped)

| Concept | API | Notes |
|---------|-----|-------|
| Time | `s.advanceTime` / `s.until` / `s.never` | Virtual clock + net queue; timers fire on scheduler advance |
| Network | `s.apply(pauseNetwork\|release\|…)` / mesh actions | Asymmetric `{ toServer, toClient }` links; restoreNetwork restores |
| Node | `disconnect` / `reconnect` / `takeOver` / `crash` / `restart` / `clearLocalData` | Soft session + hard crash with persisted client storage |
| Client | `dispatch`, `snapshot`, `hash`, `isSynced`, `isConnected`, `isCrashed`, inject helpers | Black-box |
| Server | `serverSnapshot()`, `serverHash()`, `serverCrash` / `serverRestart`, `storage` | Storage log fold (authority); hydrate on restart |
| Settle | `expectInSync(s)` / `recoverAll` + `s.until(inSync)` | Clear arms, recoverAll crashed nodes, restoreNetwork nets, soft-cycle, drain; hashes == log fold; queues drained; lastSeq == tip |
| Invariants | `s.read(invariantViolations)` / properties | Mid-chaos: seq contiguity, live-vs-log, dedup stable, durable≈memory queue |

Connectivity triad — do not conflate:

1. `client.disconnect()` / `connect()` — transport session (offline optimistic queue)
2. `world.net(id).set('hold'|'down')` — mesh reality (frames not delivered)
3. Offline dispatch while disconnected — Room feature; scenarios prove flush on welcome

**Not simulated:** real WebSocket, full CF DO hibernation runtime (covered by DO unit tests).

### Fixtures (`@pkgs/room-harness`)

| Fixture | Purpose |
|---------|---------|
| `TestCounterModule` | Increment/Decrement; hash converge check |
| `DeadlineFixtureModule` | Start → Schedule(Expire); Act vs Expire races (M6/M7) |
| `MatchClockFixtureModule` | Dual banks; Move reschedules; FlagFall terminal (MC-01..06) |
| `AuthzFixtureModule` | Claim/Bump owner authz across reconnect (M5) |

### Quick start (framework world)

```ts
import { describe, expect, test } from 'bun:test';
import { expectInSync } from '@pkgs/room-harness';
import { addClient, dispatch, pauseNetwork, resumeNetwork } from '@pkgs/room-harness';
import { counterSystem } from '../apps/counter/system';
import { Increment, counterValue } from '../fixtures/counter-module';
import { readClient, readServer } from '@pkgs/room-harness';

describe('room harness', () => {
  test('partition then restoreNetwork', async () => {
    await using s = await counterSystem.run({ seed: 3 });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(pauseNetwork, 'bob');
    await s.apply(dispatch, { clientId: 'alice', payload: Increment({}) });
    await s.apply(resumeNetwork, 'bob');
    await expectInSync(s);
    expect(counterValue(await readServer(s))).toBe(1);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
  });
});
```

Games outside this package:

```ts
import {
  bootRoomHarness,
  ROOM_ARGS,
  ROOM_DRAW,
  roomSystemCatalog,
  roomVirtual,
  runModuleConformance,
} from '@pkgs/room-harness';
import { defineSystem } from '@pkgs/harness';
```

---

## Design constraints (for contributors / agents)

- No `@pkgs/sync-engine` dependency (room stays a leaf).
- No bare wall I/O in harness or product paths — inject `createHarnessAdapters` / clock.
  Wall helpers only in tests / `@io-wall-ok` entry roots (repo-wide rule).
- Tiger size caps (`biome.json`) — split helpers; no size-rule ignores.
- Domain hard-delete rules belong to sync-engine SQL; room uses event fold only.
- Prefer extending `tests/*.test.ts` for multi-client / partition /
  offline / clock regressions before adding wall sleeps to loopback tests.
- When changing `handle` / wire / schedule semantics, update this catalog and
  keep **server-first** asserts in harness.

### Feedback / design checklist

When proposing a change, check:

1. Does domain truth still live only in the committed event log?
2. If time is involved, is the wake a `Schedule` effect (not a client-only timer)?
3. Are effects optional on success and absent on reject?
4. Will unknown custom effects fail loudly (handler claim protocol)?
5. Is there a harness scenario (or kit row) that would catch the regression?
6. Does `hash(state)` stay deterministic (see `docs/DETERMINISM.md`)?

---

## Tiger Style

- Assert on hot paths where violation means impossible state.
- No bare `catch` — surface via `onError` or disconnect (broadcast drops dead sockets).
- Fail loudly on bad wire (unknown `kind` / version) and unhandled effects.
- Named invariants (`TIGER_INVARIANTS` in `tiger-invariants.ts`):
  - Mid-chaos: `log-seq-contiguity`, `live-vs-log`, `command-id-dedup-stable`,
    `durable-queue-matches-memory`
  - Post-converge: `healed-queue-drained`, `client-lastseq-equals-server-tip`
- Static bounds (`bounds.ts`): `MAX_PENDING_OUTBOUND_COMMANDS`,
  `MAX_WELCOME_ENTRIES_PER_FRAME`, `MAX_ROSTER_SIZE` — over-bound command
  enqueue → `room.error/rate-limited`; welcome batches truncate and client
  re-syncs; roster register throws when full.
- Client memory is applied synchronously per frame; durable writes ride one
  write-behind serial and the queue is persisted as a snapshot of memory, so
  an ack can never leave a ghost durable row.

## Security posture

- Auth at upgrade (401/403 before game frames).
- Optional authorize per topic/command (also applies to `injectCommand`).
- Never trust client-only validation for integrity; server runs `module.handle`.
- Dedup by `commandId` limits replay amplification.
- Scheduler identity is a known system actor; modules decide whether to accept
  flag/expire from `room:scheduler` and/or any identity once `command.ts` is due.

---

## Scenario / test catalog

Complete inventory of what this package currently proves. Prefer adding rows
here when you add coverage. Paths are under `pkgs/room/src/` unless noted.

### Room specs (`specs/rooms/`, run by `@pkgs/room-harness`)

`@pkgs/room-harness` claims the `rooms` spec domain: its `test:e2e` runs the
features through `tests/steps/` and replays the models' traces through
`tests/quint/` (seeded by `FC_SEED`; the harness must reach the model's state
after every step).

| Spec | Covers |
|------|--------|
| `shared-counter.feature` | A change reaches the room and the device; two people's changes all count and both are present; an offline change shows only on its author's device, then reaches everyone; a stalled network sees nothing new, then catches up; a waiting change survives an app crash; a crashed room is down and comes back with its count; a crash right after a confirmed change recovers |
| `presence.feature` | Someone whose device goes offline is no longer present; someone who reconnects is present again |
| `refusals.feature` | A change the room does not understand is refused as invalid, nothing waits, nothing changes; a person the room turns away is refused as not allowed |
| `match-clock.feature` | Flag falls on the room clock; a move passes the clock; a stalled or offline player can neither move after nor beat the flag; an early flag claim does not end the match |
| `shared-counter.qnt` | Model: increments / decrements across offline, stalled networks, app crash and restart, room restart, resent command ids and session take-over (exactly once), unknown and malformed messages |
| `match-clock.qnt` | Model: start / move / claim flag / wait on the room clock; status, turn, both banks, winner, what each device shows |

Same seed twice: each model's binding gives a `fingerprint` (room and
device hashes), and the Quint runner replays its longest trace twice and
requires the same end state. The wire side of malformed messages
(non-Message payload refused, unknown kind ignored) is
`pkgs/room/tests/room-server.contract.test.ts`. Code tests in
`pkgs/room-harness/tests/`: `standalone-room.test.ts` (`openLoopbackRoom`).

### Module kit harness (`/room/harness` kit)

| File | ID | Asserts / use case |
|------|----|--------------------|
| `purity-and-seed.harness.test.ts` | M1/M8 | `runModuleConformance` on counter |
| `hash-canonicality.harness.test.ts` | M2 | Hash independent of key insertion order |
| `totality-sweep.harness.test.ts` | M3 | Handle never throws across corpus; ok ⇒ non-empty events |
| `fold-closure.harness.test.ts` | M4 | Reduce over ordered log stays valid |
| `authz-survives-reconnect.harness.test.ts` | M5 | Non-owner unauthorized after soft reconnect |
| `terminal-monotonicity.harness.test.ts` | M6 | Schedule Expire wins; late act/expire no-ops |
| `deadline-vs-action.harness.test.ts` | M7 | Lagging partitioned client cannot beat engine Schedule expire |
| `engine-fuzz-sequences.harness.test.ts` | E1/M* | Deadline fixture fuzz via real engine |

### Fixture-only harness

| File | ID | Asserts / use case |
|------|----|--------------------|
| `tests/fixtures/counter-module.harness.test.ts` | M8 | Pure `TestCounterModule` under `createHarnessAdapters` seed-stable |

### Game-layer harness (outside this package)

| File | ID | Asserts / use case |
|------|----|--------------------|
| `libs/chess/.../chess-puzzle.conformance.harness.test.ts` | Gp-01 | `ChessModule` via `runModuleConformance` |
| `libs/chess/.../scenarios/host-auth-partition.harness.test.ts` | Gp-02 | Non-host reject under hold; converge |
| `libs/chess/.../scenarios/solved-monotonic.harness.test.ts` | Gp-03 | Post-solved cmds leave terminal hash |
| `libs/chess/.../scenarios/wrong-vs-solved-race.harness.test.ts` | Gp-04 | Two host tabs race → one status |
| `libs/chess/.../scenarios/competition-races.template.harness.test.ts` | Gc template | Skipped stakes races until competition module exists |

### Loopback / client core

| File | Kind | Asserts / use case |
|------|------|--------------------|
| `room-roster.test.ts` | Loopback | Roster grow/shrink; multi-tab same actor; actor+ts stamped on log |
| `client/core/room-offline-dispatch.test.ts` | Offline fake transport | `RoomClient.open` survives connect throw; optimistic queue while disconnected |
| `client/core/room-server-reset.test.ts` | Loopback / reset | Ignore duplicate committed ≤ tip; recover short/stale welcome; idempotent re-welcome |
| `client/core/room-ghost-queue.test.ts` | Ghost queue | Committed ack before `appendQueued` leaves durable queue empty |

### Server core

| File | Kind | Asserts / use case |
|------|------|--------------------|
| `server/core/room-server-envelope.test.ts` | Unit | Non-Message command payload → `rejected` / invalid-command |
| `server/core/room-server-welcome.test.ts` | Unit | Welcome `lastSeq` matches log tail even if storage tip read is wrong |

### Adapters (DO + client)

| File | Kind | Asserts / use case |
|------|------|--------------------|
| `room-adapter-durable-object` `storage.test.ts` | DO storage | Per-key append/load; dedup keys; v2→v3 blob migrate; reject seq gaps |
| `room-adapter-durable-object` `do-schedule.test.ts` | DO schedule | Schedule persists + arms alarm; `fireDue` injects and clears KV |
| `room-adapter-durable-object` `hibernation.test.ts` | DO host | After simulated eviction, passive peer still receives committed |
| `room-adapter-durable-object` `session-takeover.test.ts` | DO host | Same `(identity, clientId)` replaces socket; different `clientId` keeps both |
| `room-adapter-durable-object` `auth-upgrade.test.ts` | DO host | Missing identity header on upgrade → HTTP 401 |
| `room-adapter-web` `websocket-transport.test.ts` | WS transport | Heartbeat ping; reconnect on missed pong; `probeLiveness`; pong clears miss |
| `client/adapters/storage/key-value/storage.test.ts` | KV storage | Corrupt committed/queued blobs load empty and are zapped |

### Engine unit (`pkgs/room/tests/`)

| File | Kind | Asserts / use case |
|------|------|--------------------|
| `room-client.contract.test.ts` | Contract (fake transport) | Welcome flushes offline queue; own-echo skips rebase + keeps snapshot ref; foreign commit rebases; `getLog` copy-on-read; append-only coalesced persistence, no ghost row; reject / stale welcome / gap; hydrate + corrupt-cache wipe; rate limit; event-driven `untilSynced` |
| `room-server.contract.test.ts` | Contract (recording connections) | One shared frame object per broadcast; cached tip (no `getLastSeq` per command); dedup replay; envelope / unknown reject; ping / capped welcome; `injectCommand` actor; hydrate + roster |
| `key-value-storage.test.ts` | Unit | Segmented `Kv` log: multi-segment append + reload, reset, corrupt segment / queue wipe |
| `room-adapter-web/tests/client-storage.test.ts` | Unit | Segmented `localStorage` log: tail-only writes, legacy blob + corrupt segment cleared |
| `room-adapter-memory/tests/client-storage.test.ts` | Unit | Append / reset / queue snapshot isolation |
| `bench/hot-paths.bench.ts` | Bench (not a test) | Old vs current µs/op: dispatch, echo round trip, foreign commit, 5k-log commit, welcome-512, hash |

### Pure helpers

| File | Kind | Asserts / use case |
|------|------|--------------------|
| `tests/hash-room-state.test.ts` | PBT | Limb FNV == BigInt reference; canonical JSON == sorted-copy reference (incl. index-like keys, `undefined`, functions, `__proto__`) |
| `tests/wire.test.ts` | Unit | Frame round-trip; garbage / bad error / bad roster rejected |
| `hash-room-state.test.ts` | Unit | Canonical JSON key sort; insertion-order-independent FNV hash |
| `hash-room-state.pbt.test.ts` | PBT | Key-order + array significance + integer-like insertion independence |
| `protocol/wire.pbt.test.ts` | PBT | Client/server wire JSON round-trip; garbage → null; rate-limited error |
| `tests/client-storage.pbt.test.ts` | PBT | Memory/web/KV queue append/remove round-trip + serial remove |
| `tests/bench/hot-paths.bench.test.ts` | Hang-only | Dispatch burst, welcome-256, hash nested state |

Curated exports for games: `@pkgs/room-harness` (`bootRoomHarness`,
`roomSystemCatalog`, `roomVirtual`, kit helpers, fixtures). Prefer adding a row above whenever you add coverage.
