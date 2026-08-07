# Sync-engine deterministic simulation

TigerBeetle-style DST for `@pkgs/sync-engine`. One seed → identical timeline.

## What is simulated

| Boundary | Implementation                                                |
| -------- | ------------------------------------------------------------- |
| Time     | `SimClock` + `SimScheduler` (discrete events)                 |
| Timers   | `createSimTimers` implements the production `Timers` port     |
| RNG      | `createSeededRng` (splitmix64)                                |
| Network  | `SimNetwork` — delay, loss, reorder, replay, partition        |
| HTTP     | `createSimHttpClient` / `bindSimHttpServer` over the mesh     |
| PubSub   | `createSimPubSubBroker` (delayed fanout over the same mesh)   |
| Server   | in-process pg-mem + real `processMutationsBatch` / `runQuery` |
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
import { simSetNote } from './profile';

const world = await openSimWorld({ seed: 42 });
const a = await world.addClient({ id: 'alice' });
await a.mutate(simSetNote, { id: 'n1', body: 'hi' });
await world.assertConverged();
await world.dispose();
```

## Fanout scenarios

Named coverage lives in `fanout.scenario.test.ts` (row-image fanout enabled in
sim clients + server):

- Happy path contiguous apply, dropped/reordered/duped fanout, tombstones
- Pending-mutation race, epoch wipe, seed sweep, &lt;200ms latency budget

Convergence check: after quiescence, every client’s live-row view matches the
server and pending `_mutations` queues are empty.

## Replay a failing seed

Fuzz failures print `seed=<hex>`. Replay:

```bash
SYNC_SIM_SEED=42 bun test pkgs/sync-engine/src/sim/world.fuzz.test.ts
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
// pass sim.timers / sim.now / sim.random into SubscriptionRuntime, attachPush, etc.
await sim.runFor(150); // advance virtual time
```

## Layout

```
sim/
  rng.ts clock.ts scheduler.ts timers.ts   # kernel
  network.ts http-bridge.ts pubsub-bridge.ts
  world.ts client-factory.ts server.ts profile.ts
  faults.ts workload.ts invariants.ts replay.ts
  fanout.scenario.test.ts                  # row-image fanout acceptance
  test-driver.ts                           # lightweight unit-test helper
```
