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
| PubSub   | `createSimPubSubBroker` (delayed fanout)                      |
| Server   | in-process pg-mem + real `processMutationsBatch` / `runQuery` |
| Clients  | Bun `:memory:` SQLite + real `createLocalSyncEngine`          |

Not simulated: disk bitflips, real EMQX, Cloudflare Worker runtime.

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
// pass sim.timers / sim.now / sim.random into SubscriptionRuntime, attachNudges, etc.
await sim.runFor(150); // advance virtual time
```

## Layout

```
sim/
  rng.ts clock.ts scheduler.ts timers.ts   # kernel
  network.ts http-bridge.ts pubsub-bridge.ts
  world.ts client-factory.ts server.ts profile.ts
  faults.ts workload.ts invariants.ts replay.ts
  test-driver.ts                           # lightweight unit-test helper
```
