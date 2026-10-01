// @sql-vendor-ok — local SQLite client schema uses PRAGMA user_version.
import type { Schema } from '@pkgs/db-schema';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';
import { reconcileOutbox } from '@pkgs/outbox';
import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  ensureFrameworkSchema,
  RETIRED_LOCAL_TABLES,
  SCHEMA_EPOCH,
} from '../queries/client/local-schema';
import {
  FRAMEWORK_CACHE_TABLE_NAMES,
  FRAMEWORK_DURABLE_TABLE_NAMES,
} from '../shared/framework-server-ddl';

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

function quoteIdent(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid SQLite identifier: ${value}`);
  }
  return `"${value}"`;
}

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

async function dropRetiredTables(db: SqlClient): Promise<void> {
  for (const name of RETIRED_LOCAL_TABLES) {
    await db.run(unsafe(`DROP TABLE IF EXISTS ${quoteIdent(name)}`));
  }
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

async function dropCacheTables(
  db: SqlClient,
  schema: LocalDomainSchema
): Promise<void> {
  try {
    for (const name of allCacheTableNames(schema)) {
      await db.run(unsafe(`DROP TABLE IF EXISTS ${quoteIdent(name)}`));
    }
    await dropRetiredTables(db);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`dropCacheTables: ${detail}`, { cause: error });
  }
}

async function createCurrentSchema(
  db: SqlClient,
  schema: LocalDomainSchema
): Promise<void> {
  try {
    await dropRetiredTables(db);
    await ensureFrameworkSchema(db);
    await reconcileOutbox(db);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`ensureFrameworkSchema: ${detail}`, { cause: error });
  }
  await ensureDomainTables(db, schema);
}

async function cacheTablesExist(
  db: SqlClient,
  schema: LocalDomainSchema
): Promise<boolean> {
  for (const name of allCacheTableNames(schema)) {
    const rows = await db.query(
      unsafe<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`
      )
    );
    if (rows.length === 0) return false;
  }
  return true;
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
 * Resolves `true` when the CACHE tables were (re)created empty, so the
 * caller re-applies queued writes the device still shows.
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
    // Interrupted epoch bump: CACHE wiped but user_version not advanced — restoreNetwork in place.
    if (
      previousEpoch >= epoch &&
      previous >= targetVersion &&
      !(await cacheTablesExist(db, schema))
    ) {
      await createCurrentSchema(db, schema);
      await onPhase?.('afterEnsure');
      await db.run(unsafe(`PRAGMA user_version = ${targetVersion}`));
      await onPhase?.('done');
      return true;
    }
    const wiped = previousEpoch < epoch;
    if (wiped) {
      await dropCacheTables(db, schema);
      await onPhase?.('afterCacheWipe');
    }
    await createCurrentSchema(db, schema);
    await onPhase?.('afterEnsure');

    await db.run(unsafe(`PRAGMA user_version = ${targetVersion}`));
    await onPhase?.('done');
    return wiped;
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
  await dropCacheTables(db, schema);
  await createCurrentSchema(db, schema);
}
