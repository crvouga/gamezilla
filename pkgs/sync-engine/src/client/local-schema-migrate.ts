import type { Schema } from '@pkgs/db-schema';
import { sqlite } from '@pkgs/db-schema/sqlite';
import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  ensureFrameworkSchema,
  ensureOptimisticSchema,
  SCHEMA_EPOCH,
} from '../queries/client/local-schema';
import {
  FRAMEWORK_CACHE_TABLE_NAMES,
  FRAMEWORK_DURABLE_TABLE_NAMES,
} from '../shared/framework-server-ddl';

const VERSION_STRIDE = 1_000;
const DURABLE_TABLES = new Set<string>(FRAMEWORK_DURABLE_TABLE_NAMES);

export type LocalDomainSchema = {
  /** Declarative domain schema reconciled via `@pkgs/db-schema/sqlite`. */
  readonly domainSchema: Schema;
  /** Domain table names wiped on CACHE clear / epoch bump. */
  readonly cacheTableNames: readonly string[];
};

type Migration = (db: SqlClient, schema: LocalDomainSchema) => Promise<void>;

const MIGRATIONS: readonly Migration[] = [
  async (db, schema) => {
    await ensureFrameworkSchema(db);
    await ensureDomainTables(db, schema);
  },
  async (db) => {
    const columns = await db.query(
      unsafe<{ name: string }>('PRAGMA table_info("_upload_state")')
    );
    if (!columns.some((column) => column.name === 'next_seq')) {
      await db.run(
        unsafe(
          'ALTER TABLE "_upload_state" ADD COLUMN "next_seq" INTEGER NOT NULL DEFAULT 1'
        )
      );
    }
  },
  async (db) => {
    await ensureOptimisticSchema(db);
  },
];

const CURRENT_USER_VERSION = SCHEMA_EPOCH * VERSION_STRIDE + MIGRATIONS.length;

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

async function ensureDomainTables(
  db: SqlClient,
  schema: LocalDomainSchema
): Promise<void> {
  try {
    await sqlite(schema.domainSchema, db, {
      ownership: 'declared-only',
    }).reconcile();
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
    await ensureFrameworkSchema(db);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`ensureFrameworkSchema: ${detail}`, { cause: error });
  }
  await ensureDomainTables(db, schema);
}

async function runPendingMigrations(
  db: SqlClient,
  schema: LocalDomainSchema,
  fromVersion: number
): Promise<void> {
  const fromStep = fromVersion % VERSION_STRIDE;
  for (let index = fromStep; index < MIGRATIONS.length; index += 1) {
    const migration = MIGRATIONS[index];
    if (migration !== undefined) await migration(db, schema);
  }
}

/** Runs additive migrations and applies an epoch-triggered CACHE-only wipe. */
export async function migrateLocalSchema(
  db: SqlClient,
  schema: LocalDomainSchema
): Promise<void> {
  const previous = await readUserVersion(db);
  const previousEpoch = Math.floor(previous / VERSION_STRIDE);

  try {
    if (previousEpoch < SCHEMA_EPOCH) {
      await dropCacheTables(db, schema);
      await createCurrentSchema(db, schema);
    } else if (previous < CURRENT_USER_VERSION) {
      await runPendingMigrations(db, schema, previous);
    } else {
      await ensureDomainTables(db, schema);
    }

    await db.run(unsafe(`PRAGMA user_version = ${CURRENT_USER_VERSION}`));
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
