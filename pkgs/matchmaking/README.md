# @pkgs/matchmaking

Storage-agnostic matchmaking queue. One port (`Matchmaking`), one SQL
adapter (`impl-sql`) that runs the same portable SQL on SQLite and
Postgres. Matching runs in the app layer inside DB transactions with
row claims so workers stay horizontally scalable and nearly stateless.

On Postgres, boot installs `@pkgs/postgres-sqlite-compat` so SQLite-shaped
JSON helpers (`json_extract`, `json_each`, …) are available.

---

## Quick start

```ts
import { createAttrNamespace } from '@pkgs/matchmaking/interface';
import { MatchmakingImplSql } from '@pkgs/matchmaking/impl-sql';
import { createPgPool } from '@pkgs/sql-client/postgres/connect';

const { sqlClient } = createPgPool({
  connectionString: process.env.DATABASE_URL,
  dbScope: { schema: 'public' },
});

const ns = createAttrNamespace('chess');
const rating = ns('rating', (v) => (typeof v === 'number' ? v : 0));
const mode = ns('mode', (v) => (typeof v === 'string' ? v : 'casual'));

const mm = new MatchmakingImplSql({
  sqlClient,
  schema: {
    partitionKeys: ['chess/mode'],
    primaryNumericKey: 'chess/rating',
    bucketWidth: 50,
  },
  tuning: { now: () => io.clock.now(), createId: io.createId },
});
await mm.ready();

const { participantId } = await mm.join({
  data: { ...rating(1500), ...mode('blitz') },
  formulas: [{ numeric: [{ tag: rating, weight: 1 }] }],
});
```

---

## Public surface

| Subpath | Contents |
|---------|----------|
| `@pkgs/matchmaking/interface` | `Matchmaking` port, domain types, `createMatchmakingApp`, limits |
| `@pkgs/matchmaking/impl-sql` | `MatchmakingImplSql`, `MatchmakingDatabaseMigration` |
| `@pkgs/matchmaking/wire` | `FormulaWire` types for HTTP / RPC |
| `@pkgs/matchmaking/client` | `MatchmakingClient` |
| `@pkgs/matchmaking/testing` | Framework sim (`matchmaking` system + actions / observations, `startMatchmaking`) + fixtures |

Anything outside these subpaths is internal.

## Testing

All tests live under `src/tests/`. Deterministic scenarios use a seeded
`@pkgs/dst` system that boots **N Matchmaking replicas sharing one DB** —
the horizontal-scale composition root. Tests only ever `start` a run and
drive it with `apply` / `observe`; there is no direct surface access.

```text
pkgs/matchmaking/src/
  sim/scenario/                   # defineMatchmakingSystem + node kinds
  testkit.ts                    # @pkgs/matchmaking/testing facade
  tests/
    fixtures/
    hygiene/
    adapter/
    scenarios/                  # *.sim.test.ts + *.scenario.pbt.test.ts
```

```ts
import {
  join,
  RatingAttr,
  startMatchmaking,
  statusOf,
  tickAllWith,
} from '@pkgs/matchmaking/testing';

await using run = await startMatchmaking({
  seed: 3,
  replicas: 3,
  // backend: 'postgres', // required for concurrent tickAll claim races
});

await run.apply(join, {
  ref: 'a',
  replicaId: 'r0',
  input: {
    data: RatingAttr(1000),
    formulas: [{ numeric: [{ tag: RatingAttr, weight: 1 }] }],
  },
});
await run.apply(tickAllWith, { maxPassesPerPartition: 4 });
expect(await run.observe(statusOf('a'))).not.toBeNull();
```

| Concept | API |
|---------|-----|
| Time | `passTime`; wait via `untilObserved` / `neverObserved` on `matched(...)` |
| Replicas | `addReplica`, `tick` / `tickAll` / `tickAllWith` actions |
| Port | `join` / `leave` / `ready` / `updateFormulas` / `httpRequest` actions; `statusOf` / `statuses` / `lastTick` / `lastHttp` observations |

Scenarios assert only port observables — never SQL tables or claim
columns. CI: `bun run --filter @pkgs/matchmaking test`.

```bash
bun run --filter @pkgs/matchmaking test
bun run --filter @pkgs/matchmaking test:sim
```

Hosts drive pairing via `Matchmaking.tick()` / `POST /tick`. Concurrent
ticks across replicas are safe: each pass claims waiting rows inside a
transaction.
