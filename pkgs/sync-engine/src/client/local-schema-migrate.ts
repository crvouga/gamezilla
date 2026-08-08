import type { Schema } from '@pkgs/db-schema';
import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema/sqlite';
import { createLogger } from '@pkgs/logger';
import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

const domainMigrateLogger = createLogger({
  name: 'local-schema-migrate',
  level: 'silent',
});

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

export type LocalDomainSchema = {
  /** Declarative domain schema applied via `SqliteSchemaDatabaseMigration`. */
  readonly domainSchema: Schema;
  /** Domain table names wiped on CACHE clear / epoch bump. */
  readonly cacheTableNames: readonly string[];
};

type Migration = (db: SqlClient, schema: LocalDomainSchema) => Promise<void>;

const MIGRATIONS: readonly Migration[] = [
  async (db, schema) => {
    await dropRetiredTables(db);
    await ensureFrameworkSchema(db);
    await ensureDomainTables(db, schema);
  },
];

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
    await new SqliteSchemaDatabaseMigration(schema.domainSchema, {
      ownership: 'declared-only',
    }).migrate({ sqlClient: db, logger: domainMigrateLogger });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`ensureDomainTables/migrate: ${detail}`, {
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

export type LocalMigratePhase =
  | 'before'
  | 'afterCacheWipe'
  | 'afterEnsure'
  | 'done';

export type MigrateLocalSchemaOptions = {
  /** Override {@link SCHEMA_EPOCH} (sim / migrate testing). */
  readonly schemaEpoch?: number;
  /** Boundary hook between migrate phases (sim crash injection). */
  readonly onLocalMigratePhase?: (
    phase: LocalMigratePhase
  ) => void | Promise<void>;
};

/** Runs additive migrations and applies an epoch-triggered CACHE-only wipe. */
export async function migrateLocalSchema(
  db: SqlClient,
  schema: LocalDomainSchema,
  options?: MigrateLocalSchemaOptions
): Promise<void> {
  const epoch = options?.schemaEpoch ?? SCHEMA_EPOCH;
  const targetVersion = epoch * VERSION_STRIDE + MIGRATIONS.length;
  const onPhase = options?.onLocalMigratePhase;
  const previous = await readUserVersion(db);
  const previousEpoch = Math.floor(previous / VERSION_STRIDE);

  try {
    await onPhase?.('before');
    if (previousEpoch < epoch) {
      await dropCacheTables(db, schema);
      await onPhase?.('afterCacheWipe');
      await createCurrentSchema(db, schema);
      await onPhase?.('afterEnsure');
    } else if (previous < targetVersion) {
      await runPendingMigrations(db, schema, previous);
      await onPhase?.('afterEnsure');
    } else {
      await ensureDomainTables(db, schema);
      await onPhase?.('afterEnsure');
    }

    await db.run(unsafe(`PRAGMA user_version = ${targetVersion}`));
    await onPhase?.('done');
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
