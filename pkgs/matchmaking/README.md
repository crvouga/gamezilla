# @pkgs/matchmaking

Storage-agnostic matchmaking queue. One port (`Matchmaking`), one SQL
adapter (`@pkgs/matchmaking-sql`) that runs the same portable SQL on SQLite and
Postgres. Matching runs in the app layer inside DB transactions with
row claims so workers stay horizontally scalable and nearly stateless.

On Postgres, boot installs `@pkgs/postgres-sqlite-compat` so SQLite-shaped
JSON helpers (`json_extract`, `json_each`, …) are available.

---

## Quick start

```ts
import { createAttrNamespace } from '@pkgs/matchmaking/interface';
import { MatchmakingImplSql } from '@pkgs/matchmaking-sql';
import { createPgPool } from '@pkgs/sql-client-postgres/connect';

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

| Package / subpath | Contents |
|-------------------|----------|
| `@pkgs/matchmaking/interface` | `Matchmaking` port, domain types, `createMatchmakingApp`, limits |
| `@pkgs/matchmaking-sql` | `MatchmakingImplSql`, `MatchmakingDatabaseMigration` |
| `@pkgs/matchmaking/wire` | `FormulaWire` types for HTTP / RPC |
| `@pkgs/matchmaking/client` | `MatchmakingClient` |
| `@pkgs/matchmaking-harness` | Framework harness (`matchmaking` system + actions / reads, fixtures) |

Anything outside these entrypoints is internal.

## Testing

All tests live under `tests/`. Deterministic scenarios use a seeded
`@pkgs/harness` system that boots **N Matchmaking replicas sharing one DB** —
the horizontal-scale composition root. Tests only ever `run` a system and
drive it with `apply` / `read`; there is no direct access to `S` internals.

```text
pkgs/matchmaking-harness/
  src/                            # exported as `@pkgs/matchmaking-harness`
    scenario/                     # matchmaking system + node kinds
pkgs/matchmaking/
  tests/                          # black-box against package exports
```

```ts
import {
  join,
  matchmaking,
  RatingAttr,
  statusOf,
  tickAllWith,
} from '@pkgs/matchmaking-harness';

await using s = await matchmaking.run({
  seed: 3,
  // backend: 'postgres' — required for concurrent tickAll claim races
  args: { replicas: 3 },
});

await s.apply(join, {
  ref: 'a',
  replicaId: 'r0',
  input: {
    data: RatingAttr(1000),
    formulas: [{ numeric: [{ tag: RatingAttr, weight: 1 }] }],
  },
});
await s.apply(tickAllWith, { maxPassesPerPartition: 4 });
expect(await s.read(statusOf, 'a')).not.toBeNull();
```

| Concept | API |
|---------|-----|
| Time | `s.advanceTime`; radius waits via `stepTime` + `s.read(matched, …)` |
| Replicas | `addReplica`, `tick` / `tickAll` / `tickAllWith` actions |
| Port | `join` / `leave` / `ready` / `updateFormulas` / `httpRequest` actions; `statusOf` / `statuses` / `lastTick` / `lastHttp` reads |

Scenarios assert only port observables — never SQL tables or claim
columns. CI: `bun run --filter @pkgs/matchmaking test`.

The acceptance behavior (waiting, stopping, being matched, the same answer
at every replica) is the Matchmaking context in `specs/matchmaking/`
(Gherkin features plus the `matching.qnt` model), run by
`@pkgs/matchmaking-harness`'s `test:e2e` through `tests/steps/` and
`tests/quint/`; the runner also replays the model's longest trace twice and
requires the same match fingerprint (same seed, same outcome). The package
`test` keeps the schema-drift contract.

```bash
bun run --filter @pkgs/matchmaking test
bun run --filter @pkgs/matchmaking-harness test
bun run spec --package @pkgs/matchmaking-harness
```

Hosts drive pairing via `Matchmaking.tick()` / `POST /tick`. Concurrent
ticks across replicas are safe: each pass claims waiting rows inside a
transaction.
