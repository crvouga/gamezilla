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
| Timers   | `createSimTimers` implements the production `Timers` port     |
| RNG      | `createSeededRng` (splitmix64)                                |
| Network  | `SimNetwork` — delay, loss, reorder, replay, partition        |
| HTTP     | `createSimHttpClient` / `bindSimHttpServer` over the mesh     |
| PubSub   | `createSimPubSubBroker` (delayed fanout over the same mesh)   |
| Server   | in-process PGlite + `applyFrameworkServerDdl` + schema reconcile |
| Clients  | Bun `:memory:` SQLite + real `createLocalSyncEngine`          |

Not simulated: disk bitflips, real EMQX, Cloudflare Worker runtime.

## Network fault model

`SimFaultOptions` (`faults.ts`) applies to **both** HTTP and pubsub deliveries:

| Knob | Effect |
|------|--------|
| `oneWayDelayMeanMs` / `oneWayDelayJitterMs` | Delivery delay |
| `packetLossProbability` | Drop message |
| `packetReplayProbability` | Duplicate delivery |
| `reorderWindow` | Extra delay for reordering |
| `partitionProbability` / `unpartitionProbability` | Fuzz partitions |

`RELIABLE_FAULTS` zeros all of the above. Scenarios that need a one-shot drop
should `setFaults` after clients connect, then restore `RELIABLE_FAULTS` before
`assertConverged` (100% loss also blocks HTTP session sync).

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

## Fanout / correctness scenarios

Named coverage lives in `src/tests/scenarios/` (row-image fanout enabled in
sim clients + server):

- Happy path peer visibility, dropped/reordered/duped fanout, tombstones
- Offline conflict, pending-mutation race, crash/restart rehydrate
- Folders multi-table, authz deny, hard-delete reject, latency budget
- Seed corpus fuzz (`fuzz.test.ts`)

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
  network.ts http-bridge.ts pubsub-bridge.ts
  world.ts client-factory.ts server.ts
  notes-app/                         # tiny defineSchema + mutations/queries
  faults.ts workload.ts invariants.ts replay.ts
  test-driver.ts

tests/
  scenarios/                         # black-box correctness suite
  harness/                           # sim kernel self-tests
```
