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
  dialect: 'postgres',
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

Hermetic tests use Bun SQLite (`dialect: 'sqlite'`) or PGlite
(`dialect: 'postgres'`) — same code path.

---

## Public surface

| Subpath | Contents |
|---------|----------|
| `@pkgs/matchmaking/interface` | `Matchmaking` port, domain types, `createMatchmakingApp`, limits |
| `@pkgs/matchmaking/impl-sql` | `MatchmakingImplSql`, `MatchmakingDatabaseMigration` |
| `@pkgs/matchmaking/wire` | `FormulaWire` types for HTTP / RPC |
| `@pkgs/matchmaking/client` | `MatchmakingClient` |
| `@pkgs/matchmaking/testing` | Contract runners + fixtures |

Anything outside these subpaths is internal.

## Contract tests

Behavioral suites live in `@pkgs/matchmaking/testing` and take a factory
that returns a `Matchmaking`. Default `bun test` runs them as a matrix
against Bun SQLite and PGlite (+ compat):

```bash
bun run --filter @pkgs/matchmaking test
```

Hosts drive pairing via `Matchmaking.tick()` / `POST /tick`. Concurrent
ticks are safe: each pass claims waiting rows inside a transaction.
