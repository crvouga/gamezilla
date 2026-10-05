/**
 * Postgres-backed {@link EntityStore}. Schema owned by defineTable
 * (`entityStoreSchema`) — not product appSchema / sync.
 */

import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';

import { entityStoreId } from './entity-id';
import type {
  EntityStore,
  EntityStoreKey,
  EntityStoreRow,
  EntityStoreUpsertArgs,
} from './interface';
import { reconcileEntityStorePostgres } from './reconcile-postgres';

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
  constructor(
    private readonly sqlClient: SqlClient,
    private readonly now: () => number
  ) {}

  static async open(args: {
    sqlClient: SqlClient;
    now: () => number;
  }): Promise<EntityStoreImplPostgres> {
    await EntityStoreImplPostgres.reconcile(args.sqlClient);
    return new EntityStoreImplPostgres(args.sqlClient, args.now);
  }

  /** Bring `entity_store` in line on Postgres. */
  static async reconcile(sqlClient: SqlClient): Promise<void> {
    await reconcileEntityStorePostgres(sqlClient, {
      skipAdvisoryLock: true,
      alreadyInTransaction: false,
    });
  }

  async upsert(args: EntityStoreUpsertArgs): Promise<void> {
    const id = entityStoreId(args.namespace, args.type, args.externalId);
    const ownerId = args.ownerId ?? null;
    const dataJson = JSON.stringify(args.data);
    const iso = new Date(this.now()).toISOString();
    await this.sqlClient.run(sql<void>`
      INSERT INTO entity_store (
        id, namespace, type, external_id, owner_id, data,
        created_at, updated_at, deleted_at
      )
      VALUES (
        ${id},
        ${args.namespace},
        ${args.type},
        ${args.externalId},
        ${ownerId},
        ${dataJson},
        ${iso},
        ${iso},
        ${null}
      )
      ON CONFLICT (namespace, type, external_id) DO UPDATE SET
        owner_id = COALESCE(excluded.owner_id, entity_store.owner_id),
        data = excluded.data,
        updated_at = excluded.updated_at,
        deleted_at = NULL
    `);
  }

  async get(key: EntityStoreKey): Promise<EntityStoreRow | null> {
    const rows = await this.sqlClient.query(sql<Row>`
      SELECT id, namespace, type, external_id, owner_id, data, created_at, updated_at
      FROM entity_store
      WHERE namespace = ${key.namespace}
        AND type = ${key.type}
        AND external_id = ${key.externalId}
        AND deleted_at IS NULL
      LIMIT 1
    `);
    const first = rows[0];
    if (first === undefined) return null;
    return toRow(first);
  }

  async delete(key: EntityStoreKey): Promise<void> {
    const iso = new Date(this.now()).toISOString();
    await this.sqlClient.run(sql<void>`
      UPDATE entity_store
      SET deleted_at = ${iso}, updated_at = ${iso}
      WHERE namespace = ${key.namespace}
        AND type = ${key.type}
        AND external_id = ${key.externalId}
        AND deleted_at IS NULL
    `);
  }
}
