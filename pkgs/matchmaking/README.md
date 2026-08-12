# @pkgs/matchmaking

Storage-agnostic matchmaking queue. One port (`Matchmaking`), multiple
adapters (`impl-sql`, `impl-in-memory`). Contract tests couple only to
the interface so backends can be swapped without rewriting tests.

---

## Quick start (production — SQL)

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

Hermetic tests use the in-memory adapter (no Postgres):

```ts
import { MatchmakingImplInMemory } from '@pkgs/matchmaking/impl-in-memory';

const mm = new MatchmakingImplInMemory({
  schema: {},
  tuning: { now: () => io.clock.now(), createId: io.createId },
});
```

---

## Public surface

| Subpath | Contents |
|---------|----------|
| `@pkgs/matchmaking/interface` | `Matchmaking` port, domain types, `createMatchmakingApp`, limits |
| `@pkgs/matchmaking/impl-sql` | `MatchmakingImplSql`, `MatchmakingDatabaseMigration` |
| `@pkgs/matchmaking/impl-in-memory` | `MatchmakingImplInMemory` |
| `@pkgs/matchmaking/wire` | `FormulaWire` types for HTTP / RPC |
| `@pkgs/matchmaking/client` | `MatchmakingClient` |
| `@pkgs/matchmaking/testing` | Contract runners + fixtures |

Anything outside these subpaths is internal.

```ts
import type {
  Matchmaking,
  DistanceFormula,
  JoinInput,
  MatchmakingSchema,
} from '@pkgs/matchmaking/interface';
import { MATCHMAKING_PAYLOAD_LIMITS, createAttrNamespace } from '@pkgs/matchmaking/interface';
import { MatchmakingImplSql } from '@pkgs/matchmaking/impl-sql';
import type { FormulaWire } from '@pkgs/matchmaking/wire';
import { MatchmakingClient } from '@pkgs/matchmaking/client';
```

## Contract tests

Behavioral suites live in `@pkgs/matchmaking/testing` and take a factory
that returns a `Matchmaking`. Default `bun test` runs them against
`MatchmakingImplInMemory`. SQL conformance is opt-in:

```bash
bun run --filter @pkgs/matchmaking test           # in-memory + lockdown
bun run --filter @pkgs/matchmaking test:contract  # PGlite / SQL adapter
```

Production deployments rely on `pg_cron` to drive `matchmaking_tick()`
every few seconds. Tests call `await mm.tick()` directly instead.
