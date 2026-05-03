# entity-db

Thin Postgres data-plane for rows keyed by `(namespace, type, id)` with JSON payloads and a conditional upsert driven by a consumer-supplied `compareVersions` callback.

**Consumers choose whether to run bundled DDL.** This package exports column name constants (`ENTITY_DB_COLUMNS`, `DEFAULT_POSTGRES_ENTITY_TABLE`), a typed client, and Postgres migration aligned with **patch-db** and **kv**: `EntityDbImplPostgres.migrate({ sqlClient, logger, tableName?, schema? })` (static only; `tableName` defaults to `entities`). For prod cleanup after moving off entity-db, use `EntityDbImplPostgres.migrateDown({ sqlClient, logger, tableName?, schema? })` — idempotent `DROP TABLE … CASCADE`. The app `apps/db` wires migrations in `apps/db/src/postgres-migrations.ts` (CLI `scripts/migrate-db.ts` and in-process `migrate.ts`).

## API

```ts
import { createEntityDb } from '@gamezilla/lib/entity-db/factory';
import { EntityDbImplPostgres } from '@gamezilla/lib/entity-db/impl-postgres';
import {
  DEFAULT_POSTGRES_ENTITY_TABLE,
  ENTITY_DB_COLUMNS,
} from '@gamezilla/lib/entity-db/constants';
import { createLogger } from '@gamezilla/lib/logger';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';

const logger = createLogger({ name: 'my-app' });
await EntityDbImplPostgres.migrate({ sqlClient, logger });
// Or a custom physical table (tests, multi-tenant): migrate({ sqlClient, logger, tableName: 'my_entities' });

const client = createEntityDb({
  sqlClient,
  // tableName defaults to DEFAULT_POSTGRES_ENTITY_TABLE (`entities`)
  schema: 'public', // optional
  compareVersions: (incoming, existing) => {
    /* return -1 | 0 | 1 — required, no default */
  },
});
await client.upsert({
  namespace: 'ns',
  type: 'user',
  id: 'u1',
  data: { ... },
  metadata: { ... }, // optional; stored as `{}` when omitted on insert
});
const row = await client.get({ namespace: 'ns', type: 'user', id: 'u1' });
await client.delete({ namespace: 'ns', type: 'user', id: 'u1' });
```

- **Identifiers:** When set, `tableName` and optional `schema` must match `^[a-zA-Z_][a-zA-Z0-9_]{0,62}$` (Postgres-safe unquoted identifiers). The default table is `entities`.
- **Parameters:** All user values use `?` placeholders on `SqlClient`; only validated identifiers are interpolated into SQL.
- **Transactions:** The Postgres implementation uses `SELECT ... FOR UPDATE` inside `sqlClient.transaction(...)`. For correct locking, use a `SqlClient` backed by a real DB transaction (e.g. Bun TCP Postgres), not a fake no-op `transaction` (some in-process adapters).

## Recommended schema (copy into your migration)

Use `ENTITY_DB_COLUMNS` so column names stay aligned with the client.

Primary key on `(namespace, type, id)` includes the partition key `namespace`. The table is **`PARTITION BY LIST (namespace)`** with a **`DEFAULT`** child so every namespace is stored automatically (dedicated partitions can be added later for large tenants). Secondary indexes are defined on the parent and attach to all partitions.

```sql
CREATE TABLE IF NOT EXISTS entities (
  namespace        TEXT        NOT NULL,
  type             TEXT        NOT NULL,
  id               TEXT        NOT NULL,
  data             JSONB       NOT NULL,
  metadata         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  last_modified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (namespace, type, id)
) PARTITION BY LIST (namespace);

CREATE TABLE IF NOT EXISTS entities_default PARTITION OF entities DEFAULT;

CREATE INDEX IF NOT EXISTS entities_type_id_idx
  ON entities (type, id);

CREATE INDEX IF NOT EXISTS entities_last_modified_at_idx
  ON entities (last_modified_at DESC);

CREATE INDEX IF NOT EXISTS entities_namespace_type_last_modified_at_idx
  ON entities (namespace, type, last_modified_at DESC);

CREATE INDEX IF NOT EXISTS entities_data_gin_idx
  ON entities USING GIN (data jsonb_path_ops);

CREATE INDEX IF NOT EXISTS entities_metadata_gin_idx
  ON entities USING GIN (metadata jsonb_path_ops);
```

Column names should match `ENTITY_DB_COLUMNS` in `./constants.ts`.

## Down migration (prod cleanup)

When the app no longer uses entity-db rows, drop the physical table idempotently:

```ts
await EntityDbImplPostgres.migrateDown({ sqlClient, logger });
// Optional: custom physical table (same rules as migrate)
// await EntityDbImplPostgres.migrateDown({ sqlClient, logger, tableName: 'my_entities', schema: 'public' });
```

This runs `DROP TABLE IF EXISTS … CASCADE` on the parent partitioned table, which removes the default LIST partition and all indexes. **Destructive** — all entity-db rows are deleted. The free function `migrateDownEntityDbPostgres` is the implementation (same args shape as `migrateEntityDbPostgres`).

## Tests

Contract tests live in `interface.test.ts` (in-memory `EntityDb`). Run:

```sh
cd libs/lib && bun test src/entity-db
```
