import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  ensureFrameworkSchema,
  ensureOptimisticSchema,
  SCHEMA_EPOCH,
} from '@pkgs/sync-engine/queries/client/local-schema';
import {
  FRAMEWORK_CACHE_TABLE_NAMES,
  FRAMEWORK_DURABLE_TABLE_NAMES,
} from '@pkgs/sync-engine/shared/framework-server-ddl';

const VERSION_STRIDE = 1_000;
const DURABLE_TABLES = new Set<string>(FRAMEWORK_DURABLE_TABLE_NAMES);

export type LocalDomainSchema = {
  /** Raw SQLite CREATE TABLE statements for product domain tables. */
  readonly domainDdl: readonly string[];
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
  for (const ddl of schema.domainDdl) {
    const statements = ddl
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await db.run(unsafe(stmt));
    }
  }
}

async function dropCacheTables(
  db: SqlClient,
  schema: LocalDomainSchema
): Promise<void> {
  for (const name of allCacheTableNames(schema)) {
    await db.run(unsafe(`DROP TABLE IF EXISTS ${quoteIdent(name)}`));
  }
}

async function createCurrentSchema(
  db: SqlClient,
  schema: LocalDomainSchema
): Promise<void> {
  await ensureFrameworkSchema(db);
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
  await db.transaction(async (tx) => {
    if (previous > 0 && previousEpoch !== SCHEMA_EPOCH) {
      await dropCacheTables(tx, schema);
    }
    const migrationBase = previousEpoch === SCHEMA_EPOCH ? previous : 0;
    await runPendingMigrations(tx, schema, migrationBase);
    await createCurrentSchema(tx, schema);
    await tx.run(unsafe(`PRAGMA user_version = ${CURRENT_USER_VERSION}`));
  });
}

/** Clears re-hydratable CACHE tables while preserving mutation durability. */
export async function clearLocalCache(
  db: SqlClient,
  schema: LocalDomainSchema
): Promise<void> {
  await db.transaction(async (tx) => {
    await dropCacheTables(tx, schema);
    await createCurrentSchema(tx, schema);
  });
}
