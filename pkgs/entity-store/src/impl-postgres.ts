/**
 * Postgres-backed {@link EntityStore}. Table layout and DDL are private to
 * this module — owned by `@pkgs/entity-store`, not `libs/db` / sync.
 *
 * Schema is applied via {@link EntityStoreImplPostgres.migrateUp} during
 * `db:migrate` (same pattern as `@pkgs/kv`).
 */

import type { Logger } from '@pkgs/logger';
import { raw, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { entityStoreId } from './entity-id';
import type {
  EntityStore,
  EntityStoreKey,
  EntityStoreRow,
  EntityStoreUpsertArgs,
} from './interface';

const TABLE = 'entity_store';

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS ${TABLE} (
  id text NOT NULL PRIMARY KEY,
  namespace text NOT NULL,
  type text NOT NULL,
  external_id text NOT NULL,
  owner_id text,
  data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (namespace, type, external_id)
)
`;

const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS entity_store_namespace_owner_idx ON ${TABLE} USING btree (namespace, owner_id)`,
  `CREATE INDEX IF NOT EXISTS entity_store_namespace_type_idx ON ${TABLE} USING btree (namespace, type)`,
];

async function runEntityStoreMigrations(
  sqlClient: SqlClient,
  log: Logger
): Promise<void> {
  const existing = await sqlClient.query(sql<{ tablename: string }>`
    SELECT tablename FROM pg_tables
     WHERE schemaname = current_schema() AND tablename = ${TABLE}`);
  if (existing.length === 0) {
    log.info('entity_store postgres migrate: applying ddl', { table: TABLE });
    await sqlClient.run(raw(CREATE_TABLE.trim()));
    for (const stmt of CREATE_INDEXES) {
      await sqlClient.run(raw(stmt));
    }
    log.info('entity_store postgres migrate: ddl applied', { table: TABLE });
  } else {
    log.info('entity_store postgres migrate: table exists (skipping create)', {
      table: TABLE,
    });
    for (const stmt of CREATE_INDEXES) {
      await sqlClient.run(raw(stmt));
    }
  }
}

function parseData(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
}

type Row = {
  id: string;
  namespace: string;
  type: string;
  external_id: string;
  owner_id: string | null;
  data: unknown;
  created_at: string | Date;
  updated_at: string | Date;
};

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toRow(r: Row): EntityStoreRow | null {
  const data = parseData(r.data);
  if (data === null) return null;
  return {
    id: r.id,
    namespace: r.namespace,
    type: r.type,
    externalId: r.external_id,
    ownerId: r.owner_id,
    data,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

export class EntityStoreImplPostgres implements EntityStore {
  constructor(private readonly sqlClient: SqlClient) {}

  static async open(args: {
    sqlClient: SqlClient;
    logger: Logger;
  }): Promise<EntityStoreImplPostgres> {
    await EntityStoreImplPostgres.migrateUp(args);
    return new EntityStoreImplPostgres(args.sqlClient);
  }

  /** Idempotent Postgres DDL for the `entity_store` table. */
  static async migrateUp(args: {
    sqlClient: SqlClient;
    logger: Logger;
  }): Promise<void> {
    const log = args.logger.child({ migration: 'entity-store-postgres' });
    log.info('entity_store postgres migrate: start');
    try {
      await runEntityStoreMigrations(args.sqlClient, log);
      log.info('entity_store postgres migrate: complete');
    } catch (error) {
      log.error('entity_store postgres migrate: failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async upsert(args: EntityStoreUpsertArgs): Promise<void> {
    const id = entityStoreId(args.namespace, args.type, args.externalId);
    const ownerId = args.ownerId ?? null;
    const dataJson = JSON.stringify(args.data);
    await this.sqlClient.run(sql<void>`
      INSERT INTO entity_store (
        id, namespace, type, external_id, owner_id, data, created_at, updated_at
      )
      VALUES (
        ${id},
        ${args.namespace},
        ${args.type},
        ${args.externalId},
        ${ownerId},
        ${dataJson}::text::jsonb,
        now(),
        now()
      )
      ON CONFLICT (namespace, type, external_id) DO UPDATE SET
        owner_id = COALESCE(excluded.owner_id, entity_store.owner_id),
        data = excluded.data,
        updated_at = excluded.updated_at
    `);
  }

  async get(key: EntityStoreKey): Promise<EntityStoreRow | null> {
    const rows = await this.sqlClient.query(sql<Row>`
      SELECT id, namespace, type, external_id, owner_id, data, created_at, updated_at
      FROM entity_store
      WHERE namespace = ${key.namespace}
        AND type = ${key.type}
        AND external_id = ${key.externalId}
      LIMIT 1
    `);
    const first = rows[0];
    if (first === undefined) return null;
    return toRow(first);
  }

  async delete(key: EntityStoreKey): Promise<void> {
    await this.sqlClient.run(sql<void>`
      DELETE FROM entity_store
      WHERE namespace = ${key.namespace}
        AND type = ${key.type}
        AND external_id = ${key.externalId}
    `);
  }
}
