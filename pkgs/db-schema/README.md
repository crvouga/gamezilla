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
| **SQLite** | Same extra-column rule as Postgres. **In-place type/nullability change is forbidden** (same as server). Rebuild only for deprecated extras, lifecycle copy (`renamedFrom`/`widenedFrom`), and CHECK/FK shape SQLite cannot `ALTER`. Row-preserving rebuild: rename old → create new → copy → drop old. |

`ownership: 'declared-only'` (**default** for SQLite) leaves undeclared tables alone so
package-local infra schemas (sync-engine, outbox, …) can share the SQLite file
via their own `applySqliteSchema` / `SqliteSchemaDatabaseMigration` passes.
`whole-db` drops undeclared tables (test / wholly-owned DBs only).

## Lifecycle recipes (expand / contract)

Never rename or change types in place on **either dialect**.

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

## Identifiers

All table/column/check/view/enum **names** must be `snake_case` (lowercase start;
letters, digits, underscore; no `__`; no trailing `_`; ≤63 UTF-8 bytes). Reserved
SQL keywords (`table`, `index`, `user`, …) are rejected. Enum **values** are data,
not identifiers — any string is allowed.

Physical type overrides (`postgres:` / `sqlite:` on column specs) are allowlisted
to known mappings from `type-map.ts` — raw DDL injection is not permitted.

## Product entry points

```ts
import { defineTable, registerTables } from '@pkgs/db-schema';
import {
  applyPostgresSchema,
  PostgresSchemaDatabaseMigration,
} from '@pkgs/db-schema/postgres';
import {
  applySqliteSchema,
  SqliteSchemaDatabaseMigration,
} from '@pkgs/db-schema/sqlite';

export const appSchema = registerTables([...TABLES]);

// server migrate composition
new PostgresSchemaDatabaseMigration(appSchema, dbScope, {
  skipAdvisoryLock: true,
  alreadyInTransaction: true,
});

// client local migrate / tests
new SqliteSchemaDatabaseMigration(appSchema, { ownership: 'declared-only' });
// or: await applySqliteSchema(client, appSchema, { ownership: 'declared-only' });
```

**Infra packages** (sync-engine, kv, outbox, …) use the same `defineTable` API with
a package-local schema — never register those tables in product `appSchema`.
Never author `CREATE TABLE` strings; Biome grit `no-raw-create-table` bans them
outside `@pkgs/db-schema` emit.

## Tests

See [`TESTING.md`](TESTING.md). Summary:

- Contract matrix: `interface.contract.test.ts` (postgres-mem × sqlite-mem)
- PBT: `src/tests/pbt/` + `src/core/*.pbt.test.ts` (conventions, planner, emit safety, round-trip, data-loss)
- System worlds: `tests/scenario/` (N sqlite clients + 1 postgres server, mixed versions)
- Findings: [`src/tests/bugs-found.md`](src/tests/bugs-found.md)
