# @pkgs/matchmaking

Storage-agnostic matchmaking queue. One port (`Matchmaking`), one SQL
adapter (`@pkgs/matchmaking-sql`) that runs the same portable SQL on SQLite and
Postgres. Matching runs in the app layer inside DB transactions with
row claims so workers stay horizontally scalable and nearly stateless.

On Postgres, boot installs `@pkgs/postgres-sqlite-compat-shared-ts` so SQLite-shaped
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
| `@pkgs/matchmaking-sql` | `MatchmakingImplSql` |
| `@pkgs/matchmaking/wire` | `FormulaWire` types for HTTP / RPC |
| `@pkgs/matchmaking/client` | `MatchmakingClient` |
| `@pkgs/matchmaking-root-harness-ts` | The example app and the framework harness (`matchmaking` system + actions / reads) |

Anything outside these entrypoints is internal.

## Testing

`@pkgs/matchmaking` is tested through **one example app**
(`pkgs/matchmaking-root-harness-ts/src/`): a lobby where named people
wait for a rated match. It declares its own attributes (`RatingAttr`,
`NameAttr`, and `RegionAttr` / `ModeAttr` to partition by), the formula
people accept each other with (`ratingWithin`) and its schema
(`exampleAppSchema`). Every test, model and spec drives that app; a test that
needs a variation (another schema version) configures it rather than
declaring its own attributes.

The deterministic harness is a seeded `@pkgs/harness-root-shared-ts` system that boots **N
replicas of the example app sharing one DB** — the horizontal-scale
composition root. Tests only ever `run` the system and drive it with
`apply` / `read`, and assert only port observables — never SQL tables or
claim columns.

```text
pkgs/matchmaking-root-harness-ts/
  src/example-app/   # the one example app
  src/scenario/      # the matchmaking system, its actions and reads
  tests/             # contract tests (schema drift, replicas, unknown waits)
  tests/steps/       # step definitions for specs/matchmaking/*.feature
  tests/quint/       # the binding for specs/matchmaking/matching.qnt
```

The acceptance behavior (waiting, stopping, changing one's range, being
matched) is the Matchmaking context in `specs/matchmaking/` (Gherkin
features plus the `matching.qnt` model), run by
`@pkgs/matchmaking-root-harness-ts`'s `test:spec`; the runner also replays the
model's longest trace twice and requires the same match fingerprint (same
seed, same outcome).

```bash
bun run --filter @pkgs/matchmaking-root-harness-ts test
bun run spec --package @pkgs/matchmaking-root-harness-ts
```

Hosts drive pairing via `Matchmaking.tick()` / `POST /tick`. Concurrent
ticks across replicas are safe: each pass claims waiting rows inside a
transaction.
