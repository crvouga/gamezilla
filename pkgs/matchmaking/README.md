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
| `@pkgs/matchmaking/testing` | Framework sim (`openMatchmakingWorld` → World / `MATCHMAKING_SYSTEM`) + fixtures |

Anything outside these subpaths is internal.

## Testing

All tests live under `src/tests/`. Deterministic scenarios use a seeded
framework world (`@pkgs/determinism`) that boots **N Matchmaking replicas
sharing one DB** — the horizontal-scale composition root.

```text
pkgs/matchmaking/src/
  sim/system/                   # defineMatchmakingSystem + node kinds
  testkit.ts                    # @pkgs/matchmaking/testing facade
  tests/
    fixtures/
    hygiene/
    adapter/
    scenarios/                  # *.sim.test.ts + *.system.pbt.test.ts
```

```ts
import {
  openMatchmakingWorld,
  RatingAttr,
  requireMmWorld,
} from '@pkgs/matchmaking/testing';

await using host = await openMatchmakingWorld({
  seed: 3,
  replicas: 3,
  // backend: 'postgres', // required for concurrent tickAll claim races
});
const world = requireMmWorld(host.state);

const a = await world.join(
  { data: RatingAttr(1000), formulas: [{ numeric: [{ tag: RatingAttr, weight: 1 }] }] },
  'r0'
);
await world.tickAll({ maxPassesPerPartition: 4 });
```

| Concept | API |
|---------|-----|
| Time | `runFor`, `until`, `never` (each step advances clock then `tickAll`) |
| Replicas | `addReplica`, `replica(id)`, `tick` / `tickAll` |
| Port | `join` / `status` / `leave` / `updateFormulas` / `mm.app()` |

Scenarios assert only port observables — never SQL tables or claim
columns. CI: `bun run --filter @pkgs/matchmaking test`.

```bash
bun run --filter @pkgs/matchmaking test
bun run --filter @pkgs/matchmaking test:sim
```

Hosts drive pairing via `Matchmaking.tick()` / `POST /tick`. Concurrent
ticks across replicas are safe: each pass claims waiting rows inside a
transaction.
