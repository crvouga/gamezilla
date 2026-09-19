# `@pkgs/db-schema`

Declarative domain schema with **safe reconciliation** for Postgres (server) and
SQLite (client). Product code declares tables once via `defineTable` /
`registerTables`; dialect migration classes apply the catalog. There is **no
public `reconcile()` API**.

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
|**Postgres**|Fail-closed. Never `DROP TABLE/COLUMN`, `ALTER TYPE`, `RENAME`. An extra column needs a `retiredColumns`/`retiredTables` tombstone or reconcile fails. Every tombstone must still exist with its frozen type — that is the proof an older client can still read it.|
|**SQLite**|Client-tolerant. Undeclared columns are **preserved verbatim** (a stale or newer bundle never bricks and never loses local data). Tombstoned columns are dropped by a row-preserving rebuild. Declared-column type/nullability mismatch is drift on both dialects.|

`ownership: 'declared-only'` (**default** for SQLite) leaves undeclared tables alone so
package-local infra schemas (sync-engine, outbox, …) can share the SQLite file
via their own `applySqliteSchema` / `SqliteSchemaDatabaseMigration` passes.
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
Never `ALTER … TYPE` on Postgres.

## Portable objects

Supported: tables, columns, indexes, unique indexes.

**Out of scope** (use a package-owned `DatabaseMigration`): checks, foreign keys,
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
[`libs/runtime/src/root/app-schema.ts`](../../libs/runtime/src/root/app-schema.ts)).
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

Two committed artifacts enforce it in PR CI (`//#check`):

- [`libs/runtime/schema-snapshot.json`](../../libs/runtime/schema-snapshot.json) +
  `bun run --filter @libs/runtime check:schema-evolution` — the committed
  snapshot must equal `appSchema.snapshot()`, and the change must be a legal
  evolution of the snapshot on the comparison ref (`origin/main` / `PR_BASE`).
  Regenerate with `bun run --filter @libs/runtime schema:snapshot`, which refuses
  to write an illegal evolution.
- `apps/server/contract-manifest.json` +
  `bun run --filter @apps/server check:contract` — the query/mutation **name set
  is append-only**. Renaming one silently deletes every offline client's queued
  writes (`UNKNOWN_MUTATION` ⇒ permanent rejection ⇒ queue row dropped).

## Product entry points

```ts
import { defineTable, registerTables } from '@pkgs/db-schema';
import {
  applyPostgresSchema,
  PostgresSchemaDatabaseMigration,
  PostgresSchemaIndexReconcileMigration,
} from '@pkgs/db-schema-postgres';
import {
  applySqliteSchema,
  SqliteSchemaDatabaseMigration,
} from '@pkgs/db-schema-sqlite';

export const appSchema = registerTables([...TABLES]);
```

**Postgres** — table DDL runs inside the advisory-locked migrate transaction
(`PostgresSchemaDatabaseMigration` with `alreadyInTransaction: true`, which
leaves index DDL to the separate phase). `PostgresSchemaIndexReconcileMigration`
runs after that transaction so every build is `CREATE INDEX CONCURRENTLY`, and
it drops any invalid leftover from a previously failed build.

**SQLite** — `SqliteSchemaDatabaseMigration` / `applySqliteSchema` with
`ownership: 'declared-only'` for the shared client file. Rebuilds are bracketed
with `PRAGMA foreign_keys = OFF` + `legacy_alter_table = ON`, and an interrupted
rebuild is recovered from its `_old_<table>` staging table on the next boot.

**Infra packages** (sync-engine, kv, outbox, …) use the same `defineTable` API with
a package-local schema — never register those tables in product `appSchema`.
Never author `CREATE TABLE` strings; Biome grit `no-raw-create-table` bans them
outside `@pkgs/db-schema` emit.

## Tests

See [`docs/TESTING.md`](docs/TESTING.md). Summary:

- `pkgs/db-schema/tests/` — pure planner / evolution / snapshot suites
- `pkgs/db-schema-postgres/tests/` and `pkgs/db-schema-sqlite/tests/` — the
  shared dialect contract matrix (`src/test/contract-suite.ts`) plus
  per-dialect behavior pins
- `pkgs/sync-engine/tests/schema-drift.test.ts` — weeks-behind client scenarios
  on the real merge path
