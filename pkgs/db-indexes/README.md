# `@pkgs/db-indexes`

Dialect-agnostic, declarative index reconciler. Accepts a workload manifest of
SQL statements, computes the minimal set of indexes that workload needs, and
safely converges the database's owned `autoidx_*` indexes to that set.

CI (`assertIndexableWorkload` / `assertQueryRegistryIndexable`) fails if any
`defineQuery` statement is unindexable (not PK, schema leftmost, autoidx
candidate, or catalog allowlist). Online reconcile still skip-not-throw for
`below_min_rows` / `low_improvement`. Migrate uses `MIGRATE_RECONCILE_CONFIG`
(no row/improvement gates) and fails reconcile if desired indexes cannot
be applied.

## Public API

```ts
import {
  planIndexes,
  reconcileIndexes,
  renderPlanMarkdown,
} from '@pkgs/db-indexes';
import { createPostgresPort } from '@pkgs/db-indexes-postgres';
import { createSqlitePort } from '@pkgs/db-indexes-sqlite';

// Analyze only — no writes
const plan = await planIndexes({ manifest, db, clock });

// Analyze + execute within deadlineMs; resumable; crash-safe
const report = await reconcileIndexes({
  manifest,
  db: createPostgresPort(sqlClient, { clock }),
  clock,
  deadlineMs: 120_000,
});
```

## Testing

See [`TESTING.md`](./docs/TESTING.md) for the property layers, the
model-based index-tuning test (`tests/index-tuning.property.test.ts`: the
tuning harness against a reference model of declaring, tuning, retiring and
the team's own indexes, plus same-sequence replay), and the invariant →
assert / harness / property map. Index tuning contracts live in `specs/db-indexes/`;
this package contains their test runners and implementation checks.

## Ownership

Bounded-context Gherkin/Quint safety requirements and their outstanding adapter
coverage: [SAFETY_CONTRACT.md](../db-schema/docs/SAFETY_CONTRACT.md).

Only indexes named `autoidx_<table>_<hash8>` are created or dropped. Never
touches `ix_` / `ux_` (db-schema), PK, unique, or exclusion indexes.

## Lifecycle

Owned index not in desired set → deprecation metadata → drop only after
`deprecationWindowDays` (default 30) **and** usage unchanged. Usage since
deprecation refreshes the window.

## Dialect contract (`DbPort`)

Implement `introspectIndexes`, `introspectTables`, `readIndexUsage`,
`readOwnedMeta`, `writeOwnedMeta`, `evaluateCandidates`, `execute`,
`parseStatement`. Core is pure given these ports: same inputs + same responses
⇒ byte-identical outputs.

| Method | Postgres | SQLite |
| --- | --- | --- |
| evaluate | hypopg + EXPLAIN | copy DB / EXPLAIN QUERY PLAN |
| execute create | CREATE INDEX CONCURRENTLY | CREATE INDEX (defer if large) |
| meta | COMMENT ON INDEX | `autoidx_meta` table |

## Safety invariants

1. No DDL targets a non-owned index.
2. Crash between any two actions leaves a state from which a fresh run converges.
3. Index with observed usage since deprecation is never dropped.

## Non-goals

No live-stats adaptive indexing. No unique/exclusion constraints (db-schema).
No background daemons. No client-boot reconcile.
