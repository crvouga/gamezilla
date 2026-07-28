# @pkgs/matchmaking

Postgres-backed matchmaking queue for chess.com-scale traffic. One JS
class, one cron-driven SQL function, no domain assumptions.

The library is use-case agnostic — competitive, cooperative, hiring,
dating, party finder, anything. The caller defines every attribute,
every distance formula, every partition key. The package owns the
queue, the candidate scan, the pairing, and the sweep.

---

## Quick start

```ts
import { Matchmaking, createAttrNamespace } from '@pkgs/matchmaking';
import { createPgPool } from '@pkgs/sql-client/postgres/connect';

const { sqlClient } = createPgPool({
  connectionString: process.env.DATABASE_URL,
  dbScope: { schema: 'public' },
});

const ns = createAttrNamespace('chess');
const rating = ns('rating', (v) => (typeof v === 'number' ? v : 0));
const mode = ns('mode', (v) => (typeof v === 'string' ? v : 'casual'));

const mm = new Matchmaking({
  storage: { sqlClient },
  schema: {
    partitionKeys: ['chess/mode'],
    primaryNumericKey: 'chess/rating',
    bucketWidth: 50,
  },
});
await mm.ready();

const { participantId } = await mm.join({
  data: { ...rating(1500), ...mode('blitz') },
  formulas: [{ numeric: [{ tag: rating, weight: 1 }] }],
});

// Poll for a match.
const status = await mm.status(participantId);
```

Production deployments rely on `pg_cron` to drive
`matchmaking_tick()` every 5 seconds. PGlite unit tests call
`await mm.tick()` directly instead. Both paths take the same
advisory lock, so cron and JS ticks never double-process.

---

## Public surface

Three import subpaths. Anything outside these is internal and may
change without notice — the `package.json` `exports` map enforces it
at the Node resolver, and the root `tsconfig.json` mirrors it for
TypeScript.

```ts
// 1. The class + types most embedders need.
import {
  Matchmaking,
  MatchmakingClient,
  MatchmakingHttpError,
  MatchmakingSchemaDriftError,
  MATCHMAKING_PAYLOAD_LIMITS,
  createAttrNamespace,
  type DistanceFormula,
  type JoinInput,
  type JoinResult,
  type LeaveResult,
  type MatchedParticipant,
  type MatchedStatus,
  type MatchmakingAppOptions,
  type MatchmakingOptions,
  type MatchmakingSchema,
  type MatchmakingStorage,
  type MatchmakingTuning,
  type RadiusOptions,
  type StatusResult,
  type TickOptions,
  type TickResult,
  type UpdateFormulasResult,
  type WaitingStatus,
} from '@pkgs/matchmaking';

// 2. The `@pkgs/sql-client` SqlClient type + the PGlite test adapter.
//    Production embedders build a SqlClient via `@pkgs/sql-client`
//    (e.g. `createPgPool`) and pass it through `storage.sqlClient`.
import {
  createPgliteSqlClient,
  type SqlClient,
} from '@pkgs/matchmaking/storage';

// 3. Wire-format types for HTTP consumers that validate JSON
//    without `AttributeTag`s.
import type {
  FormulaWire,
  NumericTermWire,
  CategoricalTermWire,
  PartitionTermWire,
  RadiusOptionsWire,
} from '@pkgs/matchmaking/wire';
```

The `Matchmaking` class exposes seven methods:

- `await mm.ready()` — wait for the cached `migrate()` to complete.
- `await mm.join(input)` — enqueue a participant.
- `await mm.leave(participantId)` — remove a waiting participant.
- `await mm.status(participantId)` — `'waiting'` or `'matched'` (with peers).
- `await mm.updateFormulas(participantId, formulas)` — widen criteria mid-wait without losing FIFO position.
- `mm.app({ requireAuth })` — mount the Hono sub-app at any route.
- `await mm.tick(opts?)` — manual queue advancement (cron does this in production).

Construct with `new Matchmaking({ storage: { sqlClient }, schema })`,
passing any `@pkgs/sql-client` `SqlClient` (e.g. from `createPgPool`).

---

## What lives in Postgres

Migration owns the entire schema. `migrate()` is run automatically by
the `Matchmaking` constructor via a cached `bootPromise`; every public
method awaits it before touching the database.

| Object                          | Kind                                                  | Notes                                                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matchmaking_waiting`           | UNLOGGED, HASH-partitioned across 16 child partitions | Hot table. Every `/join` inserts here; every pass reads + deletes here. UNLOGGED skips WAL (waiting rows are recoverable — clients rejoin).                                       |
| `matchmaking_matched`           | LOGGED                                                | Short-lived tail of matched rows that `/status` polls read. Indexed by `match_id` (peer fetch) and `matched_at` (sweep).                                                          |
| `matchmaking_active_partitions` | UNLOGGED                                              | Tiny side table. Every `/join` upserts its `(partition_signature, group_size)` pair so the tick fan-out reads this instead of `SELECT DISTINCT` over the hot table. Composite PK. |
| `matchmaking_schema_state`      | LOGGED                                                | One row holding `schema_version` + `schema_fingerprint`. Used for idempotent rebuilds and for `MatchmakingSchemaDriftError` detection.                                            |
| `matchmaking_pair_compatible()` | PL/pgSQL                                              | Hard partition-term check between two participants' data.                                                                                                                         |
| `matchmaking_pair_distance()`   | PL/pgSQL                                              | Numeric + categorical distance between two participants under one formula.                                                                                                        |
| `matchmaking_pair_match()`      | PL/pgSQL                                              | Combines the two above. Honours per-formula `radius` overrides.                                                                                                                   |
| `matchmaking_run_match_pass()`  | PL/pgSQL                                              | One pass for one `(partition_signature, group_size)` pair. Assembles pairwise-compatible groups of N, atomically deletes + inserts into matched.                                  |
| `matchmaking_sweep_expired()`   | PL/pgSQL                                              | Removes waiting rows older than `maxWaitSeconds` for one partition.                                                                                                               |
| `matchmaking_sweep_matched()`   | PL/pgSQL                                              | Global cleanup of matched rows older than `matchedRetentionSeconds`.                                                                                                              |
| `matchmaking_tick()`            | PL/pgSQL                                              | The cron-driven driver. Takes the advisory lock, fans out across pairs, prunes active partitions, sweeps matched. Body is baked at migrate time with every tuning.                |

Cross-process invariants:

| Name               | Value                                                          | Used by                                                                                           |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Advisory lock id   | `MATCHMAKING_TICK_ADVISORY_LOCK_ID` (a stable 64-bit constant) | `matchmaking_tick()` SQL function AND `Matchmaking.tick()` JS driver. Shared single-flight guard. |
| Cron job name      | `matchmaking-tick`                                             | `cron.schedule(...)` / `cron.unschedule(...)` calls in `migrate.ts`.                              |
| Cron cadence       | `5 seconds`                                                    | `cron.schedule()` argument. Adjust at the schedule call, not in JS.                               |
| Schema version     | `5`                                                            | `matchmaking_schema_state.schema_version`. Bump triggers waiting-table rebuild.                   |
| Waiting partitions | `NUM_WAITING_PARTITIONS = 16`                                  | HASH partition count on `matchmaking_waiting`.                                                    |

---

## PGlite vs production cron path

| Concern         | PGlite (tests / dev)                                                                                                       | Production (real Postgres + pg_cron)                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration       | Same `migrate()` runs against PGlite                                                                                       | Same `migrate()` runs against real Postgres                                                                                                                                                                 |
| Tick driver     | Call `await mm.tick()` from tests directly                                                                                 | `pg_cron` invokes `SELECT matchmaking_tick()` every 5 seconds                                                                                                                                               |
| `cron.schedule` | `migrate.ts` no-ops the cron call (PGlite has no pg_cron)                                                                  | `migrate.ts` calls `cron.schedule('matchmaking-tick', '5 seconds', ...)` with `cron.unschedule(...)` fallback on duplicate names                                                                            |
| Advisory lock   | Same `pg_try_advisory_lock` — PGlite supports it; one in-process connection so lock+unlock always land on the same backend | Same lock id; embedders that drive `Matchmaking.tick()` from JS SHOULD pin a single client (e.g. one `pg.Client` per request via AsyncLocalStorage). pg_cron's session is naturally pinned per cron worker. |
| Concurrency     | Single in-process connection — concurrency exists in JS only                                                               | Real connection pooling, real `FOR UPDATE SKIP LOCKED` semantics                                                                                                                                            |

---

## Failure modes

- **Migrate partial failure.** Function definitions are wrapped in a transaction; the waiting-table rebuild runs outside that tx (DROP/CREATE on a partitioned table can't share a tx with subsequent CREATE FUNCTION cleanly). If a single CREATE FUNCTION fails mid-migrate, the entire function block rolls back and the prior function bodies stay reachable. The waiting-table rebuild itself is idempotent: re-running `migrate()` either replays the rebuild from the current schema fingerprint or skips it if the fingerprint already matches.
- **`MatchmakingSchemaDriftError`.** On the first call to `Matchmaker.join()` per process, the matchmaker reads `schema_fingerprint` from `matchmaking_schema_state` and asserts it equals `fingerprintForOptions(this.schema)`. A mismatch throws `MatchmakingSchemaDriftError(expected, actual)`. Cause: someone re-deployed with a different `MatchmakingSchema` (different `partitionKeys`, `primaryNumericKey`, `bucketWidth`) and forgot to either re-`migrate()` or roll the deploy. Fix: align the code and run `migrate()` once.
- **Advisory lock leak.** `Matchmaking.tick()` always runs `pg_advisory_unlock` in a `finally`. If the connection dies mid-tick, Postgres auto-releases on backend recycle. Symptom of a real leak: `pg_locks` shows a `matchmaking_tick` lock with no live tick. Mitigation: restart the affected connection; the next tick takes the lock fresh.
- **`matchedRetentionSeconds = 0`.** Disables the matched-row sweep entirely. `/status` keeps returning `'matched'` until the row is removed manually. Use only when an external system owns matched-row lifecycle (e.g. it copies them out immediately and then deletes).
- **`maxWaitSeconds = 0`.** Disables the expired-waiter sweep. Waiting rows stay forever until matched. Use only in tests or for queues with their own external timeout policy.
- **Active partitions explosion.** `matchmaking_tick()` prunes the side table on every run: drops rows older than `DEFAULT_ACTIVE_PARTITIONS_PRUNE_AGE` (24 h) with no live waiters, then hard-caps the table at `DEFAULT_ACTIVE_PARTITIONS_HARD_CAP` (50 000). If the cap fires, someone has misconfigured `partitionKeys` to include a unique id and is creating a fresh partition signature per join. Fix the schema, not the cap.

---

## Tunings

Two layers. Construction-time tunings on the `Matchmaking` class are
threaded straight through to the JS `Matchmaker` and ALSO baked into
the PL/pgSQL `matchmaking_tick()` function at migrate time — changing
them after migrate requires a re-`migrate()` to re-bake the function
body.

| Knob                                        | Default     | Unit                | Where it lives                                                                     |
| ------------------------------------------- | ----------- | ------------------- | ---------------------------------------------------------------------------------- |
| `MatchmakingSchema.partitionKeys`           | `[]`        | namespaced keywords | Migration. Empty array = one global shard.                                         |
| `MatchmakingSchema.primaryNumericKey`       | `undefined` | namespaced keyword  | Migration. Drives `primary_bucket` generated column.                               |
| `MatchmakingSchema.bucketWidth`             | `50`        | distance units      | Migration. Seeker with radius R scans `ceil(R / bucketWidth)` buckets either side. |
| `RadiusOptions.baseRadius`                  | `50`        | distance units      | Constructor + baked into `matchmaking_tick()`.                                     |
| `RadiusOptions.radiusGrowthPerSecond`       | `10`        | distance units / s  | Constructor + baked into `matchmaking_tick()`. Radius expands linearly with wait.  |
| `RadiusOptions.maxRadius`                   | `400`       | distance units      | Constructor + baked into `matchmaking_tick()`.                                     |
| `MatchmakingTuning.maxPairsPerPass`         | `500`       | pairs               | Cap on pairs produced by one `run_match_pass` invocation.                          |
| `MatchmakingTuning.maxWaitSeconds`          | `300`       | seconds             | Expired-waiter sweep threshold. 0 disables.                                        |
| `MatchmakingTuning.matchedRetentionSeconds` | `3600`      | seconds             | Matched-row sweep threshold. 0 disables.                                           |
| `TickOptions.maxPartitions`                 | `1024`      | partitions / tick   | Fan-out scan width. Bounded JS-side concurrency below.                             |
| `TickOptions.maxPassesPerPartition`         | `8`         | passes              | Per-partition drain loop cap.                                                      |
| `TickOptions.concurrency`                   | `8`         | parallel partitions | JS-side concurrency for partition drains and sweeps.                               |
| `TickOptions.signal`                        | `undefined` | AbortSignal         | Cancellation checked between partitions.                                           |
| Active partitions prune age                 | `24 * 3600` | seconds             | Baked into `matchmaking_tick()`. Watermark for empty signatures.                   |
| Active partitions hard cap                  | `50_000`    | rows                | Baked into `matchmaking_tick()`. Hard cap on side table.                           |
| Cron cadence                                | `5 seconds` | pg_cron expression  | Set in `cron.schedule('matchmaking-tick', ...)`.                                   |

Per-formula radius (set on `DistanceFormula.radius`) overrides the
global `RadiusOptions` for that formula only. Useful for multi-axis
queues where different formulas need very different distance scales.

---

## Limits

Hard payload limits enforced by the HTTP validator (`/join`,
`/update-formulas`) and by the JS public methods. Re-exported from
`@pkgs/matchmaking` as `MATCHMAKING_PAYLOAD_LIMITS` so embedders
can surface the same bounds in their own client-side validators,
API docs, or OpenAPI specs.

```ts
import { MATCHMAKING_PAYLOAD_LIMITS } from '@pkgs/matchmaking';

MATCHMAKING_PAYLOAD_LIMITS.maxDataKeys; // 64
MATCHMAKING_PAYLOAD_LIMITS.maxFormulas; // 8
MATCHMAKING_PAYLOAD_LIMITS.maxTermsPerFormula; // 32
MATCHMAKING_PAYLOAD_LIMITS.maxStringBytes; // 1024 (UTF-8)
MATCHMAKING_PAYLOAD_LIMITS.maxMetadataBytes; // 1024 (UTF-8 JSON)
```

Other bounds:

- `JoinInput.groupSize`: integer in `[2, 16]`. Default `2`. Mixed group sizes in the same partition never cross-match.
- `JoinInput.priority`: integer in `[-1000, 1000]`. Default `0`. Higher = considered first within the same primary bucket; ties fall back to FIFO.
- `JoinInput.metadata`: JSONB ≤ 1024 bytes (UTF-8). Round-trips through `status()`. The library never reads it.

---

## Concurrency that PGlite cannot test

The test suite uses PGlite exclusively. PGlite is a single in-process
Postgres compiled to WebAssembly; it is faithful at the SQL semantics
level but cannot exercise multi-backend behaviour. The following
contracts hold in production-grade Postgres but cannot be asserted
end-to-end without a real cluster:

- **`pg_try_advisory_lock` across distinct backends.** PGlite has one
  connection, so the JS `tick()` lock is always taken and released by
  the same backend. In production with a pool, the lock and unlock
  can land on different backends; the library mitigates this by
  recommending per-request client pinning via AsyncLocalStorage.
  PGlite cannot
  verify the pin works under load.
- **`FOR UPDATE SKIP LOCKED` under real contention.** The pass query
  uses `SKIP LOCKED` to let multiple `matchmaking_run_match_pass`
  invocations drain the same partition without blocking each other.
  PGlite serialises queries through one connection, so the
  no-double-claim guarantee is taken on faith from the SQL semantics
  rather than measured.
- **Hash partition lock contention.** The 16-way HASH partitioning of
  `matchmaking_waiting` is designed to spread write-lock pages across
  16 independent index chains. PGlite cannot reproduce real per-page
  lock contention; the partitioning benefit is documented but not
  benchmarked in the suite.
- **`pg_cron` invocation cadence + duplicate-name fallback.** The
  `cron.schedule` / `cron.unschedule` paths in `migrate.ts` are
  exercised against stubbed clients in tests; the actual cron worker
  loop runs only against real Postgres with the `pg_cron` extension.
- **`UNLOGGED` table recovery semantics.** WAL-skipping on the
  waiting + active-partitions tables means a crash drops every
  in-flight waiting row. The library's recovery contract is "clients
  rejoin"; PGlite cannot simulate the crash + recovery cycle.

Real-Postgres CI is intentionally out of scope; the unit suite tests
every code path that is testable in PGlite (currently 128 tests
across 3 files).

---

## Operational runbook

### Enable `pg_cron`

`pg_cron` is a Postgres extension. Most managed Postgres providers
(AWS RDS, GCP Cloud SQL, Neon, Supabase) require it to be enabled at
the cluster level before any database can `CREATE EXTENSION`.

```sql
-- Run once per cluster, by a superuser:
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- The matchmaking migration takes it from here on its first run.
```

On RDS / Cloud SQL: add `pg_cron` to the
`shared_preload_libraries` parameter group and reboot. On Neon /
Supabase: enable via the dashboard.

The `migrate()` call schedules a job named `matchmaking-tick` with a
`5 seconds` cadence. On pg_cron 1.5+ the call is idempotent; on
older versions the library catches the duplicate-name error and
falls back to `cron.unschedule('matchmaking-tick')` + reschedule.

### Watch `cron.job_run_details`

`pg_cron` records every invocation in `cron.job_run_details`. The
hot query for verifying matchmaking is alive:

```sql
SELECT
  jrd.start_time,
  jrd.end_time,
  jrd.status,
  jrd.return_message,
  jrd.command
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'matchmaking-tick'
ORDER BY jrd.start_time DESC
LIMIT 25;
```

Healthy signal: `status = 'succeeded'` rows every ~5 seconds with
`return_message` empty or a short integer. Errors surface in
`return_message`; the library does not retry inside `matchmaking_tick()`
— a failed tick is retried by the next cron firing. If errors
persist, run `SELECT matchmaking_tick();` manually from a psql
session to see the full PL/pgSQL backtrace.

### Diagnostics

```sql
-- Live queue depth per partition + group size:
SELECT partition_signature, group_size, count(*)
FROM matchmaking_waiting
GROUP BY 1, 2
ORDER BY 3 DESC
LIMIT 25;

-- Active partitions side table:
SELECT * FROM matchmaking_active_partitions ORDER BY first_seen_at DESC LIMIT 25;

-- Currently held advisory locks (look for the matchmaking_tick id):
SELECT * FROM pg_locks WHERE locktype = 'advisory';

-- Recently matched rows:
SELECT match_id, id, matched_at
FROM matchmaking_matched
ORDER BY matched_at DESC
LIMIT 50;

-- Schema fingerprint state:
SELECT * FROM matchmaking_schema_state;
```

### Re-migrate after a schema change

Bump the JS `MatchmakingSchema` (e.g. add a partition key, change
`bucketWidth`) and the next `Matchmaking` boot detects the
fingerprint mismatch and rebuilds. The waiting-table rebuild is a
DROP/CREATE — every in-flight waiting row is lost. Drain the queue
(stop accepting joins, wait for `matchmaking_waiting` to empty)
before deploying a schema change in production. The matched table is
preserved across rebuilds; the matched-row sweep continues uninterrupted.
