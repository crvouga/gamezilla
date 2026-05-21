/**
 * Engine-agnostic reconciliation of declarative snapshot indexes.
 *
 * Reads the set of index names already present in the DB (filtered to the
 * `ownedNamePrefix`), compares against the declared specs, and issues
 * `CREATE INDEX` / `DROP INDEX` DDL through the engine's {@link IndexDialect}.
 *
 * Tolerates the same `42501 must be owner of …` ownership error patch-db's
 * own DDL tolerates today, so non-owner connections (e.g. an app role that did
 * not create `snapshots`) still boot rather than crash.
 */
import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { IndexDialect } from './dialect';
import {
  normalizeIndexSpecs,
  PATCH_DB_INDEX_NAME_PREFIX,
  type PatchDbIndexSpec,
} from './index-spec';

type PgLikeError = { code?: string; message?: string };

function toPgLike(error: unknown): PgLikeError {
  return error !== null && typeof error === 'object'
    ? (error as PgLikeError)
    : {};
}

function isIgnorableOwnershipError(error: unknown): boolean {
  const e = toPgLike(error);
  return (
    e.code === '42501' &&
    /must be owner of (table|index|relation) /i.test(e.message ?? '')
  );
}

function isNoActiveTransactionError(error: unknown): boolean {
  const e = toPgLike(error);
  return (
    e.code === '25P01' &&
    /savepoint can only be used in transaction blocks/i.test(e.message ?? '')
  );
}

export type ReconcileSnapshotIndexesArgs = {
  sqlClient: SqlClient;
  logger: Logger;
  dialect: IndexDialect;
  indexes: readonly PatchDbIndexSpec[];
  /** Defaults to {@link PATCH_DB_INDEX_NAME_PREFIX}. */
  ownedNamePrefix?: string;
};

export type ReconcileSnapshotIndexesResult = {
  readonly created: readonly string[];
  readonly dropped: readonly string[];
  readonly unchanged: readonly string[];
};

export async function reconcileSnapshotIndexes(
  args: ReconcileSnapshotIndexesArgs
): Promise<ReconcileSnapshotIndexesResult> {
  const log = args.logger.child({ migration: 'patch-db-index-reconcile' });
  const ownedNamePrefix = args.ownedNamePrefix ?? PATCH_DB_INDEX_NAME_PREFIX;
  const specs = normalizeIndexSpecs(args.indexes);
  const declaredByName = new Map(specs.map((s) => [s.dbName, s] as const));
  const existingNames = await args.dialect.introspect({
    sqlClient: args.sqlClient,
    ownedNamePrefix,
  });
  const existingSet = new Set(existingNames);

  const created: string[] = [];
  const dropped: string[] = [];
  const unchanged: string[] = [];

  log.info('patch-db index reconcile: start', {
    declared: specs.length,
    existing: existingNames.length,
    ownedNamePrefix,
  });

  for (const name of existingNames) {
    if (declaredByName.has(name)) continue;
    await runOrSkip(args.sqlClient, args.dialect.ddlDrop(name), log);
    dropped.push(name);
  }

  for (const spec of specs) {
    if (existingSet.has(spec.dbName)) {
      unchanged.push(spec.dbName);
      continue;
    }
    await runOrSkip(args.sqlClient, args.dialect.ddlCreate(spec), log);
    created.push(spec.dbName);
  }

  log.info('patch-db index reconcile: complete', {
    created: created.length,
    dropped: dropped.length,
    unchanged: unchanged.length,
  });
  return { created, dropped, unchanged };
}

async function runOrSkip(
  sqlClient: SqlClient,
  stmt: string,
  log: Logger
): Promise<void> {
  const savepointName = 'patch_db_reconcile_stmt';
  let hasSavepoint = false;
  try {
    try {
      await sqlClient.run(`SAVEPOINT ${savepointName}`);
      hasSavepoint = true;
    } catch (error) {
      if (!isNoActiveTransactionError(error)) throw error;
    }

    await sqlClient.run(stmt);
    if (hasSavepoint) {
      await sqlClient.run(`RELEASE SAVEPOINT ${savepointName}`);
    }
  } catch (error) {
    if (hasSavepoint) {
      await sqlClient.run(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      await sqlClient.run(`RELEASE SAVEPOINT ${savepointName}`);
    }
    if (isIgnorableOwnershipError(error)) {
      log.warn('patch-db index reconcile: skipping ddl (non-owner)', {
        statement: stmt.slice(0, 80),
      });
      return;
    }
    log.error('patch-db index reconcile: ddl failed', {
      statement: stmt.slice(0, 200),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
