# Patch DB deterministic simulator

In-memory SQLite + simulated transport + manual push/poll for sync tests.

## Public API (`sim/index.ts`)

| Export           | Role |
|------------------|------|
| `patchDbScenario()` | Fluent builder → `Sim` |
| `Sim`            | Scenario root: `client(id)`, `server(id)`, `subscribeSyncErrors`, `destroy`, escape `scheduler` |
| `SimClient`      | `write` / `read`, `push` / `poll`, `subscribe`, `link`, `syncDb` |
| `SimServer`      | `db` — write/read as server authority |
| `SimLink`        | `partition` / `heal`, failures, latency |

## Example

```ts
import { patchDbScenario } from './sim/scenario';

const sim = await patchDbScenario()
  .server('s')
  .client('a', { server: 's' })
  .client('b', { server: 's' })
  .build();

const a = sim.client('a');
const b = sim.client('b');
const s = sim.server('s');

await a.write([
  { entityId: 'x', entityType: 'todo', attributes: { 'todo/name': 'hi' } },
]);
await a.push();
await b.poll();

const local = await b.read([{ entityType: 'todo', entityId: 'x' }]);
expect(local[0]?.patches).toHaveLength(1);

a.link.partition();
a.link.heal();

await sim.destroy();
```

`push()` and `poll()` run one sync cycle and flush subscription microtasks so tests do not need a manual `Promise.resolve()` loop.

For non-zero network latency, advance time with `await sim.scheduler.drain()` (or `tick`) as needed.

## Internal modules

`deterministic-scheduler`, `network-link`, `notifying-patches-db`, `server-port`, and `simulated-client-transport` are implementation details; import them only when extending the simulator.
