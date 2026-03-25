# Deterministic Patch-DB simulator

In-process harness for `SyncPatchesDb` with **N clients** and **N servers**, scripted network behavior, and transport-style read/write + invalidation delivery—without HTTP or wall-clock sleeps.

## Modules

| Module | Role |
|--------|------|
| `deterministic-scheduler.ts` | Logical-time priority queue (`tick` / `drain`) |
| `network-link.ts` | Partition, read/write latency, invalidation latency, injected failures |
| `notifying-patches-db.ts` | SQLite wrapper that publishes `patches-db` after writes (non–sync-host servers) |
| `simulated-client-transport.ts` | `PatchDbClientTransport` over a `NetworkLink` + server port |
| `server-port.ts` | `SimServerPort`: read/write + `subscribeInvalidations` (sync host or pubsub) |
| `scenario.ts` | `patchDbScenario()` builder, `BuiltPatchDbScenario`, `PatchDbSimDSL` |

## Quick start

Path: `src/@shared/patch-db/test/sim/`.

```ts
import { patchDbScenario } from './sim/scenario';

const sim = await patchDbScenario()
  .server('s1')
  .client('c1', { server: 's1' })
  .build();

const c = sim.getClient('c1');
await c.syncDb.write([/* … */]);
await c.runPush();
await sim.destroy();
```

- **`SyncPatchesDb`** is built with `pushDriver: 'manual'`, `pollDriver: 'manual'`. Use `runPush()` / `runPoll()` on the client handle (or `syncDb.runPushNow()` / `runPollNow()`).
- **Authority**: `sim.getServer('s1').authority` is the backing `PatchDbImplSqlite` (same DB the network “server” uses). Writes here simulate other clients or admin.

## Server modes

- **Default**: `PatchDbImplSqlite` + `NotifyingPatchesDb` + `InMemoryPubSub` — writes fan out invalidations like a simple API.
- **Merge host**: `.server('s', { useSyncHost: true })` uses `PatchDbImplSyncHost` (merge-on-read semantics as in production HTTP handler). **`PatchDbImplSyncHost.read` requires non-empty `knownPatches`**, so the client must already have at least one relevant patch locally (e.g. after a local `write` + `runPush`) before `runPoll` can succeed.

## DSL (`PatchDbSimDSL`)

Chain steps and run them against a built scenario:

```ts
const dsl = new PatchDbSimDSL()
  .partition('c1', 's1')
  .setReadWriteLatencyMs('c1', 's1', 10)
  .heal('c1', 's1')
  .flush();

await dsl.runWith(sim);
```

- **`flush()`** appends `sim.runUntilIdle()` (drains the deterministic scheduler).

## Network / transport behavior

- **Partition**: `sim.link(clientId, serverId).setPartitioned(true)` blocks reads/writes and drops invalidation delivery on that link.
- **Latency**: `setReadWriteLatencyMs` / `setInvalidationLatencyMs` schedule work on the shared `DeterministicScheduler`.
  - With **non-zero** read/write latency, delayed network I/O is enqueued only after prior awaits in the same call (e.g. `local.read` inside `pushUnsynced`). Drain with `await sim.runUntilIdle()` / `tick()` **after** those jobs exist—often several `await Promise.resolve()` microtasks, or a `while (sim.scheduler.pendingCount() > 0) await sim.tick()` loop paired with the in-flight `runPush()` promise. With **zero** latency (default), calls complete without the scheduler.
- **Failures**: `failNextReadWith(err)` / `failNextWriteWith(err)` on the link.

## Multi-server

Declare multiple `.server('s2')` and point clients with `.client('c2', { server: 's2' })`. Each client has a single remote today (one server per client).

## Sync errors

```ts
const unsub = sim.subscribeSyncErrors((e) => {
  // e.source === 'push' | 'poll'
});
```

## Subscription listeners after poll

`SyncPatchesDb` notifies subscribers via `fireAndForget` async reads. After `runPoll()`, await a short **promise flush** (see `flushSubscriptionNotifies` in `test/sync-engine.test.ts`) so entity listeners observe merged state.

## See also

- `../impl-sync/impl-sync.ts` — `runPushNow`, `runPollNow`, `pushDriver`, `pollDriver`, injectable `pushScheduler`
- `../transport/impl-http-fetch.ts` — real-world counterpart to `SimulatedPatchDbClientTransport`
