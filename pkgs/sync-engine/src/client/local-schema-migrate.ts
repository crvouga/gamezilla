import {
  ensureFrameworkSchema,
  SCHEMA_EPOCH,
} from '@pkgs/sync-engine/queries/client/local-schema';
import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { TableDefinition } from '../shared/table-definition';
import type { TableRegistry } from '../shared/table-registry';

const VERSION_STRIDE = 1_000;
const DURABLE_TABLES = new Set(['_mutations', '_upload_state']);
const FRAMEWORK_CACHE_TABLES = ['_row_scopes', '_scope_meta'] as const;

type Migration = (db: SqlClient, registry: TableRegistry) => Promise<void>;

const MIGRATIONS: readonly Migration[] = [
  async (db, registry) => {
    await ensureFrameworkSchema(db);
    await ensureDomainTables(db, registry);
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
];

const CURRENT_USER_VERSION = SCHEMA_EPOCH * VERSION_STRIDE + MIGRATIONS.length;

function quoteIdent(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid SQLite identifier: ${value}`);
  }
  return `"${value}"`;
}

function columnSql(column: TableDefinition['columns'][number]): string {
  const primaryKey = column.primaryKey === true ? ' PRIMARY KEY' : '';
  return `${quoteIdent(column.name)} ${column.type.toUpperCase()}${primaryKey}`;
}

function createTableSql(definition: TableDefinition): string {
  const columns = definition.columns.map(columnSql).join(', ');
  return `CREATE TABLE IF NOT EXISTS ${quoteIdent(definition.tableName)} (${columns})`;
}

function cacheTableNames(registry: TableRegistry): readonly string[] {
  return [
    ...registry.tableNames().filter((name) => !DURABLE_TABLES.has(name)),
    ...FRAMEWORK_CACHE_TABLES,
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
  registry: TableRegistry
): Promise<void> {
  for (const name of registry.tableNames()) {
    if (DURABLE_TABLES.has(name)) continue;
    const definition = registry.get(name);
    if (definition === undefined) continue;
    await db.run(unsafe(createTableSql(definition)));
  }
}

async function dropCacheTables(
  db: SqlClient,
  registry: TableRegistry
): Promise<void> {
  for (const name of cacheTableNames(registry)) {
    await db.run(unsafe(`DROP TABLE IF EXISTS ${quoteIdent(name)}`));
  }
}

async function createCurrentSchema(
  db: SqlClient,
  registry: TableRegistry
): Promise<void> {
  await ensureFrameworkSchema(db);
  await ensureDomainTables(db, registry);
}

async function runPendingMigrations(
  db: SqlClient,
  registry: TableRegistry,
  fromVersion: number
): Promise<void> {
  const fromStep = fromVersion % VERSION_STRIDE;
  for (let index = fromStep; index < MIGRATIONS.length; index += 1) {
    const migration = MIGRATIONS[index];
    if (migration !== undefined) await migration(db, registry);
  }
}

/** Runs additive migrations and applies an epoch-triggered CACHE-only wipe. */
export async function migrateLocalSchema(
  db: SqlClient,
  registry: TableRegistry
): Promise<void> {
  const previous = await readUserVersion(db);
  const previousEpoch = Math.floor(previous / VERSION_STRIDE);
  await db.transaction(async (tx) => {
    if (previous > 0 && previousEpoch !== SCHEMA_EPOCH) {
      await dropCacheTables(tx, registry);
    }
    const migrationBase = previousEpoch === SCHEMA_EPOCH ? previous : 0;
    await runPendingMigrations(tx, registry, migrationBase);
    await createCurrentSchema(tx, registry);
    await tx.run(unsafe(`PRAGMA user_version = ${CURRENT_USER_VERSION}`));
  });
}

/** Clears re-hydratable CACHE tables while preserving mutation durability. */
export async function clearLocalCache(
  db: SqlClient,
  registry: TableRegistry
): Promise<void> {
  await db.transaction(async (tx) => {
    await dropCacheTables(tx, registry);
    await createCurrentSchema(tx, registry);
  });
}
