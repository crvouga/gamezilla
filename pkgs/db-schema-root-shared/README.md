# `@pkgs/db-schema`

Declarative domain schema with **safe reconciliation** for Postgres (server) and
SQLite (client). Product code declares tables once via `defineTable` /
`registerTables`. Dialect packages bring a live database in line with
`reconcilePostgresSchema` / `reconcileSqliteSchema`.

## Safety model

```
desired catalog  +  introspected catalog
        ↓
  classifyDelta(caps, mode)
        ↓
   server: forbidden → throw, zero DDL
   server: additive / expand → Operation plan
   client: declare-shape only; undeclared columns are preserved
```

|Dialect|Policy|
| --- | --- |
|**Postgres**|Fail-closed. Never `DROP TABLE/COLUMN`, a general `ALTER TYPE`, or `RENAME`. Lossless repairs run in place: drop `NOT NULL` on a non-primary-key column, widen a declared `integer` stored as `int2` or `int4` to `bigint`, and drop a default on `id`, `created_at`, or `updated_at`. An extra column needs a `retiredColumns`/`retiredTables` tombstone or reconcile fails. Every tombstone must still exist with its frozen type — that is the proof an older client can still read it.|
|**SQLite**|Client-tolerant. Undeclared columns are **preserved verbatim** (a stale or newer bundle never bricks and never loses local data). Tombstoned columns are dropped by a row-preserving rebuild. A declared-column type or nullability mismatch is drift.|

`ownership: 'declared-only'` (**default** for SQLite) leaves undeclared tables alone so
package-local infra schemas (sync-engine, outbox, …) can share the SQLite file
via their own `reconcileSqliteSchema` passes.
`whole-db` drops undeclared tables (test / wholly-owned DBs only).

## Lifecycle recipes (expand / contract)

Never rename or change types in place on **either** dialect.

### Retire a column

1. Remove it from `columns`.
2. Add a `retiredColumns` tombstone carrying its **frozen type**.
3. Postgres: the column stays forever. SQLite: the next rebuild drops it.

```ts
defineTable({
  domain: 'users',
  name: 'users',
  columns: {
    display_name: { type: 'text', renamedFrom: 'name' },
  },
  retiredColumns: [
    { name: 'name', type: 'text', note: 'renamed to display_name' },
  ],
});
```

Postgres: `ADD COLUMN` + idempotent, batched `UPDATE … WHERE new IS NULL` copy.
SQLite: row-preserving rebuild with a copy alias; the tombstoned column is
dropped.

### Retire a table

```ts
registerTables(TABLES, {
  retiredTables: [
    { domain: 'notes', name: 'legacy_notes', note: 'superseded by notes' },
  ],
});
```

### Backfill

```ts
full_name: {
  type: 'text',
  backfill: { sql: "trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))" },
  // or: backfill: { from: 'other_col' }
}
```

SQL-only (deterministic). Rerun-safe (`WHERE col IS NULL`); Postgres runs it in
bounded `id`-cursor batches (`BACKFILL_BATCH_ROWS`).

### Type change

Add a **new** column with `widenedFrom: 'old'` + backfill + retire `old`.
A declared `integer` stored as `int2` or `int4` is the one in-place widen
(`TYPE bigint`). Every other type change stays drift.

## Portable objects

Supported: tables, columns, indexes, unique indexes.

**Out of scope** (reconcile does not emit them): checks, foreign keys,
views, enums, generated columns, triggers, functions, extensions, partitions,
sequences. Declaring a non-synced infra table still uses the same `defineTable`
API, but the portable-object layer above is intentionally absent.

This asymmetry is deliberate: a local-first client holds a *cache* plus an upload
queue, so any constraint the client cannot enforce would silently diverge from
the server. Constraints belong where they can be enforced on both sides — in
mutation validation.

## Types

Logical tokens: `uuid | text | integer | boolean | timestamp | json` plus
`real | blob | numeric | date`. Product `appSchema` is restricted to the six
portable tokens by `assertProductSchema` (called from
[`libs/runtime-shared/src/app-schema.ts`](../../libs/runtime-shared/src/app-schema.ts)).
Physical overrides (`postgres: 'int4'`, `sqlite: 'BLOB'`) are allowlisted and
participate in drift comparison; they are rejected in `appSchema`.

Managed implicits on every table: `id`, `created_at`, `updated_at`,
`deleted_at` (no engine `DEFAULT now()` / `gen_random_uuid()`).

## Identifiers

All table/column/index **names** must be `snake_case` (lowercase start; letters,
digits, underscore; no `__`; no trailing `_`; ≤63 UTF-8 bytes). Reserved SQL
keywords (`table`, `index`, `user`, …) are rejected. Tombstone **notes** are data.

## Schema evolution gate

An older client must keep working. Every schema change therefore has to pass
`diffSnapshots`:

|Rule|Severity|
| --- | --- |
|`table-removed` / `column-removed` without a tombstone|fatal|
|`column-type-changed`|fatal|
|`retired-column-type-changed`|fatal|
|`retired-entry-removed` (tombstones are permanent)|fatal|
|`unique-index-added` (may fail on duplicate legacy rows)|warning|
|`physical-override-added` (narrows portability)|warning|

Two committed artifacts enforce it through package-owned Turbo tasks in the Check workflow:

- [`libs/runtime-server/schema-snapshot.json`](../../libs/runtime-server/schema-snapshot.json) +
  `bun run --filter @libs/runtime-server check:schema-evolution` — the committed
  snapshot must equal `appSchema.snapshot()`, and the change must be a legal
  evolution of the snapshot on the comparison ref (`origin/main` / `PR_BASE`).
  Regenerate with `bun run --filter @libs/runtime-server schema:snapshot`, which refuses
  to write an illegal evolution.
- `apps/server/contract-manifest.json` +
  `apps/server/tests/contract-manifest.test.ts` — the query/mutation **name set
  is append-only**. Renaming one silently deletes every offline client's queued
  writes (`UNKNOWN_MUTATION` ⇒ permanent rejection ⇒ queue row dropped).

## Product entry points

```ts
import { defineTable, registerTables } from '@pkgs/db-schema';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';

export const appSchema = registerTables([...TABLES]);
```

**Postgres** — table DDL runs inside the advisory-locked reconcile transaction
(`alreadyInTransaction: true`, `indexPhase: 'skip'`). A later
`indexPhase: 'only'` pass builds every index with `CREATE INDEX CONCURRENTLY`
and drops any invalid leftover from a previously failed build.

**SQLite** — `reconcileSqliteSchema` with `ownership: 'declared-only'` for the
shared client file. Rebuilds are bracketed with `PRAGMA foreign_keys = OFF` +
`legacy_alter_table = ON`, and an interrupted rebuild is recovered from its
`_old_<table>` staging table on the next boot.

**Infra packages** (sync-engine, kv, outbox, …) use the same `defineTable` API with
a package-local schema — never register those tables in product `appSchema`.
Never author `CREATE TABLE` strings; Biome grit `no-raw-create-table` bans them
outside `@pkgs/db-schema` emit.

## Tests

Layers, invariants and backends: [`docs/TESTING.md`](docs/TESTING.md).

Framework contract examples, package model tests, coverage and
outstanding implementation obligations:
[`docs/SAFETY_CONTRACT.md`](docs/SAFETY_CONTRACT.md).
