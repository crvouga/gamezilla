// @sql-vendor-ok — local SQLite client schema uses PRAGMA user_version.
import type { Schema } from '@pkgs/db-schema-root-shared-ts/types';
import { readSqliteTableNames } from '@pkgs/db-schema-sqlite-shared-ts/catalog';
import { dropSqliteTables } from '@pkgs/db-schema-sqlite-shared-ts/driver';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { reconcileOutbox } from '@pkgs/outbox-shared-ts/reconcile';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { unsafe } from '@pkgs/sql-root-shared-ts/sql';
import {
  FRAMEWORK_CACHE_TABLE_NAMES,
  FRAMEWORK_DURABLE_TABLE_NAMES,
} from '@pkgs/sync-engine-shared-ts/framework-server-ddl';
import {
  ensureFrameworkSchema,
  markPendingForCacheReplay,
  needsCacheReplay,
  RETIRED_LOCAL_TABLES,
  SCHEMA_EPOCH,
} from './local-schema';

const VERSION_STRIDE = 1_000;
const DURABLE_TABLES = new Set<string>(FRAMEWORK_DURABLE_TABLE_NAMES);

/**
 * Target `PRAGMA user_version` after reconcile.
 * Product-harness snapshots store this to refuse restores after SCHEMA_EPOCH bumps.
 */
export function getLocalSchemaTargetVersion(
  schemaEpoch: number = SCHEMA_EPOCH
): number {
  return schemaEpoch * VERSION_STRIDE;
}

export type LocalDomainSchema = {
  /** Declarative domain schema reconciled onto the local database. */
  readonly domainSchema: Schema;
  /** Domain table names wiped on CACHE clear / epoch bump. */
  readonly cacheTableNames: readonly string[];
};

function allCacheTableNames(schema: LocalDomainSchema): readonly string[] {
  return [
    ...schema.cacheTableNames.filter((name) => !DURABLE_TABLES.has(name)),
    ...FRAMEWORK_CACHE_TABLE_NAMES,
  ];
}

async function readUserVersion(db: SqlClient): Promise<number> {
  const rows = await db.query(
    unsafe<{ user_version: number }>('PRAGMA user_version')
  );
  return Number(rows[0]?.user_version ?? 0);
}

async function ensureDomainTables(
  db: SqlClient,
  schema: LocalDomainSchema
): Promise<void> {
  try {
    await reconcileSqliteSchema(db, schema.domainSchema, {
      ownership: 'declared-only',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`ensureDomainTables/reconcile: ${detail}`, {
      cause: error,
    });
  }
}

async function createCurrentSchema(
  db: SqlClient,
  schema: LocalDomainSchema,
  tables: ReadonlySet<string>
): Promise<void> {
  try {
    await dropSqliteTables(db, RETIRED_LOCAL_TABLES, tables);
    await ensureFrameworkSchema(db);
    await reconcileOutbox(db);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`ensureFrameworkSchema: ${detail}`, { cause: error });
  }
  await ensureDomainTables(db, schema);
}

export type LocalMigratePhase =
  | 'before'
  | 'afterCacheWipe'
  | 'afterEnsure'
  | 'done';

export type MigrateLocalSchemaOptions = {
  /** Override {@link SCHEMA_EPOCH} (harness / migrate testing). */
  readonly schemaEpoch?: number;
  /** Boundary hook between migrate phases (harness crash injection). */
  readonly onLocalMigratePhase?: (
    phase: LocalMigratePhase
  ) => void | Promise<void>;
};

/**
 * Reconciles the local database and applies an epoch-triggered CACHE-only wipe.
 * Resolves `true` if a cache was recreated or an interrupted replay still has work.
 */
export async function migrateLocalSchema(
  db: SqlClient,
  schema: LocalDomainSchema,
  options?: MigrateLocalSchemaOptions
): Promise<boolean> {
  const epoch = options?.schemaEpoch ?? SCHEMA_EPOCH;
  const targetVersion = getLocalSchemaTargetVersion(epoch);
  const onPhase = options?.onLocalMigratePhase;
  const previous = await readUserVersion(db);
  const previousEpoch = Math.floor(previous / VERSION_STRIDE);

  try {
    await onPhase?.('before');
    const tables = await readSqliteTableNames(db);
    const wiped = previousEpoch < epoch;
    const repair =
      wiped || allCacheTableNames(schema).some((name) => !tables.has(name));
    if (repair && tables.size > 0) {
      await markPendingForCacheReplay(db);
    }
    if (wiped) {
      await dropSqliteTables(db, allCacheTableNames(schema), tables);
      await onPhase?.('afterCacheWipe');
    }
    await createCurrentSchema(db, schema, tables);
    await onPhase?.('afterEnsure');
    if (previous < targetVersion) {
      await db.run(unsafe(`PRAGMA user_version = ${targetVersion}`));
    }
    await onPhase?.('done');
    return repair || (await needsCacheReplay(db));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `migrateLocalSchema failed (previous=${previous}, epoch=${previousEpoch}): ${detail}`,
      { cause: error }
    );
  }
}

export async function clearLocalCache(
  db: SqlClient,
  schema: LocalDomainSchema
): Promise<void> {
  const tables = await readSqliteTableNames(db);
  await markPendingForCacheReplay(db);
  await dropSqliteTables(db, allCacheTableNames(schema), tables);
  await createCurrentSchema(db, schema, tables);
}
