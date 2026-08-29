# `@pkgs/db-schema`

Declarative domain schema with **safe reconciliation** for Postgres (server) and
SQLite (client). Product code declares tables once via `defineTable` /
`registerTables` (or `registerSchema` for views/enums); dialect migration
classes apply the catalog. There is **no public `reconcile()` API**.

## Safety model

```
desired catalog  +  introspected catalog
        ↓
  classifyDelta(caps)
        ↓
   forbidden → throw, zero DDL
   additive / expand → Operation plan
```

| Dialect | Policy |
| --- | --- |
| **Postgres** | Refuse anything non-backwards-compatible. Never `DROP TABLE/COLUMN`, `ALTER TYPE`, `RENAME`, `DROP VIEW/TYPE`. Extra columns require a deprecation tombstone or reconcile fails. |
| **SQLite** | Schema ships with the app binary. Non-deprecated extras **fail** (same as server). Deprecated objects **may** be dropped. Physical rewrite via `rebuild_table` is allowed for legal plans. |

`ownership: 'declared-only'` (product clients) leaves undeclared tables alone so
sync-engine framework tables can share the file. `whole-db` drops undeclared
tables (test / wholly-owned DBs).

## Lifecycle recipes (expand / contract)

Never rename or change types in place on the server.

### Deprecate a column

1. Remove it from `columns`.
2. Add `deprecations: [['old_col', 'reason']]`.
3. Postgres: leftover column stays. SQLite: rebuild drops it.

### Rename a column

```ts
defineTable({
  domain: 'users',
  name: 'users',
  columns: {
    display_name: { type: 'text', renamedFrom: 'name' },
  },
  deprecations: [['name', 'renamed to display_name']],
});
```

Postgres: `ADD COLUMN` + idempotent `UPDATE … WHERE new IS NULL` copy.
SQLite: rebuild with copy alias. Old column remains deprecated on Postgres.

### Backfill

```ts
full_name: {
  type: 'text',
  backfill: { sql: "trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))" },
  // or: backfill: { from: 'other_col' }
}
```

SQL-only (deterministic). Rerun-safe (`WHERE col IS NULL`).

### Type change

Add a **new** column with `widenedFrom: 'old'` + backfill + deprecate `old`.
Never `ALTER … TYPE` on Postgres.

## Portable objects

Supported: tables, columns, indexes, unique indexes, check constraints,
generated columns, foreign keys, views, enums.

**Out of scope** (use package-owned `DatabaseMigration`): triggers, functions,
extensions, partitions, sequences.

Enums default to portable `TEXT + CHECK` on both dialects. Optional
`postgres: { nativeEnum: true }` for `CREATE TYPE AS ENUM` + `ADD VALUE` only
(never remove values on Postgres).

### Synced domain tables: no FKs

The package supports `references: { table, column }`, but **product
`appSchema` must stay FK-free**. Local-first snapshot merge can insert children
without parents. Document FKs only for non-synced / infra schemas.

## Types

Logical tokens: `uuid | text | integer | boolean | timestamp | json` plus
`real | blob | numeric | date` (and enum/array specs).

Product domain tables should keep the original six until sync cell-codec is
proven for the rest.

Managed implicits on every table: `id`, `created_at`, `updated_at`,
`deleted_at` (no engine `DEFAULT now()` / `gen_random_uuid()`).

## Product entry points

```ts
import { defineTable, registerTables } from '@pkgs/db-schema';
import { PostgresSchemaDatabaseMigration } from '@pkgs/db-schema/postgres';
import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema/sqlite';

export const appSchema = registerTables([...TABLES]);

// server migrate composition
new PostgresSchemaDatabaseMigration(appSchema, dbScope, {
  skipAdvisoryLock: true,
  alreadyInTransaction: true,
});

// client local migrate
new SqliteSchemaDatabaseMigration(appSchema, { ownership: 'declared-only' });
```

## Tests

- Contract matrix: `interface.contract.test.ts` (postgres-mem × sqlite-mem)
- PBT: `*.pbt.test.ts` (compatible / forbidden deltas, type-map totality)
- DST: `tests/dst/` (N sqlite clients + 1 postgres server, mixed versions)
