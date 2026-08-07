# Sync-engine deterministic simulation

TigerBeetle-style DST for `@pkgs/sync-engine`. One seed → identical timeline.

Black-box correctness scenarios live under
[`src/tests/`](../tests/). The tiny notes domain used by the sim and by those
scenarios lives in [`notes-app/`](./notes-app/) (not under `tests/`, so
production sim code does not import from test paths). Assert domain rows only;
never framework tables or private modules.

## What is simulated

| Boundary | Implementation                                                |
| -------- | ------------------------------------------------------------- |
| Time     | `SimClock` + `SimScheduler` (discrete events)                 |
| Wall clocks | Per-node skew via `setClockSkew` / `nowFor` (scheduler stays on base clock) |
| Timers   | `createSimTimers` implements the production `Timers` port     |
| RNG      | `createSeededRng` (splitmix64)                                |
| Network  | `SimNetwork` — delay, loss, reorder, replay, partition, hold  |
| HTTP     | `createSimHttpClient` / `bindSimHttpServer` over the mesh     |
| PubSub   | `createSimPubSubBroker` (delayed fanout over the same mesh)   |
| Server   | Bun `:memory:` SQLite + framework DDL + schema reconcile      |
| Clients  | Bun `:memory:` SQLite + real `createLocalSyncEngine`          |

Not simulated: disk bitflips, real EMQX, Cloudflare Worker runtime.

## Per-node traffic controls

Public API on `SimWorld` uses semantic traffic classes (not transport names):

| Traffic | Intent |
|---------|--------|
| `live` | Realtime peer updates (pushes / fanout) |
| `sync` | Pull / request-response hydration |
| `all` | Both |

```ts
world.hold('bob', 'sync');     // pause bob's pull deliveries (queued)
world.release('bob', 'sync');  // drain without re-sampling faults
world.partition('bob', 'live'); // drop bob's realtime; sync still works
world.heal('bob');
world.setFaults('bob', 'live', { packetLossProbability: 1 });
world.clearFaults('bob');
```

**Live is unreliable by design.** Never assume live messages arrive exactly once,
in order, or at all. Control loss / dup / reorder / delay **per node** via
`setFaults(nodeId, 'live', …)`. Named tests assert domain convergence after
settle, not push ordering. `sync` stays near-reliable by default; use
`hold`/`release` to script push↔query races.

`OpenSimWorldArgs.rowImageFanout` (default `true`) — set `false` when a race
needs live → refetch instead of row-image apply.

`OpenSimWorldArgs.liveResendOnReconnect` (default `false`) — QoS-0 drop of
live publishes while a peer is closed. Set `true` to buffer that peer's last
topics and flush on re-subscribe (sim-only; production pubsub stays best-effort).

## Network fault model

`SimFaultOptions` (`faults.ts`):

| Knob | Effect |
|------|--------|
| `oneWayDelayMeanMs` / `oneWayDelayJitterMs` | Delivery delay |
| `packetLossProbability` | Drop message |
| `packetReplayProbability` | Duplicate delivery |
| `reorderWindow` | Extra delay for reordering |
| `partitionProbability` / `unpartitionProbability` | Fuzz partitions |

World-open `faults` / `sampleFaults` set the **default** profile. Per-node
overrides win for that node's `live` / `sync` / `all`. `RELIABLE_FAULTS` zeros
all knobs. `assertConverged` / settle clear holds, partitions, and node overrides.

## Quick start

```ts
import { openSimWorld } from './world';
import { setNote } from './notes-app';

const world = await openSimWorld({ seed: 42 });
const a = await world.addClient({ id: 'alice' });
await a.mutate(setNote, { id: 'n1', body: 'hi' });
await world.assertConverged();
await world.dispose();
```

## Clock skew

Scheduler / network delivery use the shared base `SimClock`. Logical wall
clocks for mutation `created_at` / soft-delete timestamps are per-node:

```ts
world.setClockSkew('alice', -60_000);
world.setClockSkew('bob', 0);
world.setClockSkew('server', 60_000);
world.nowFor('alice'); // base.now() + skew
```

## Fanout / correctness scenarios

Named coverage lives in `src/tests/scenarios/` (row-image fanout enabled in
sim clients + server unless overridden):

- Happy path peer visibility, dropped/reordered/duped fanout, tombstones
- Offline conflict, pending-mutation race, crash/restart rehydrate
- Folders multi-table, authz deny, hard-delete reject, latency budget
- Clock-skew orderings + node down/up matrix
- Push↔query races (`hold`/`release`) + live delivery chaos (per-node faults)
- Sync-path faults / sync-only partition, write-rejection drain, transient upload retry
- Background/foreground pause, multi-device same actor, requiresOnline, cold tombstone
- Query denied detach (domain rows kept), live reconnect resend knob (default drop)
- Seed corpus fuzz with skew / crash / hold / setFaults

Convergence check: after quiescence, every client’s live domain view
(notes + folders) matches the server.

## Replay a failing seed

Fuzz failures print `seed=<hex>`. Replay:

```bash
SYNC_SIM_SEED=42 bun test pkgs/sync-engine/src/tests/scenarios/fuzz.test.ts
```

Or:

```ts
import { runSeed } from './replay';
await runSeed({ seed: 0x2a, steps: 16 });
```

Env knobs:

- `SYNC_SIM_SEED` — single seed (decimal)
- `SYNC_SIM_SEEDS` — comma-separated decimal seeds

## Unit tests without a full world

```ts
import { createSimTestDriver } from './test-driver';

const sim = createSimTestDriver();
await sim.runFor(150); // advance virtual time
```

Harness self-checks (RNG / scheduler / timers) live in
`src/tests/harness/kernel.test.ts`.

## Layout

```
sim/                                 # DST implementation (not a public export)
  rng.ts clock.ts scheduler.ts timers.ts
  network.ts traffic.ts http-bridge.ts pubsub-bridge.ts
  world.ts client-factory.ts server.ts open-sim-sqlite.ts
  notes-app/                         # tiny defineSchema + mutations/queries
  faults.ts workload.ts invariants.ts replay.ts
  test-driver.ts

tests/
  scenarios/                         # black-box correctness suite
  harness/                           # sim kernel self-tests
```
