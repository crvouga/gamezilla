import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import type { ServerOperation } from '../core/operations';
import { planServer } from '../core/plan';
import type { Schema } from '../core/types';
import {
  advisoryLockSql,
  advisoryUnlockSql,
  createSchemaSql,
  readPostgresCatalog,
} from './catalog';
import { emitServerOperation, isConcurrentlyUnsupportedError } from './emit';

export type PostgresDriverOptions = {
  /**
   * Skip the package session advisory lock when the caller already holds a
   * migrate mutex (e.g. `pg_advisory_xact_lock` in api migrate).
   */
  readonly skipAdvisoryLock?: boolean;
  /**
   * When true, run table DDL on the injected client without opening a nested
   * transaction (caller already provides a transaction). Index ops still use
   * non-CONCURRENTLY emit when `indexesInTransaction` is also true.
   */
  readonly alreadyInTransaction?: boolean;
};

export type PostgresDriver = {
  reconcile(): Promise<void>;
};

type IndexOp = Extract<
  ServerOperation,
  { kind: 'create_index' | 'drop_index' }
>;

async function runIndexOp(
  client: PostgresSqlClient,
  op: IndexOp,
  concurrently: boolean
): Promise<void> {
  if (!concurrently) {
    await client.run(emitServerOperation(op, { concurrently: false }));
    return;
  }
  try {
    await client.run(emitServerOperation(op));
  } catch (err) {
    if (!isConcurrentlyUnsupportedError(err)) throw err;
    await client.run(emitServerOperation(op, { concurrently: false }));
  }
}

/**
 * Postgres schema reconciler. Non-destructive by construction: only create
 * table / add column / create|drop package-prefixed indexes.
 *
 * Namespace comes from `client.dbScope.schema` (placement only). Undeclared
 * tables in that namespace are invisible.
 */
export function postgres(
  schema: Schema,
  client: PostgresSqlClient,
  options?: PostgresDriverOptions
): PostgresDriver {
  const skipAdvisoryLock = options?.skipAdvisoryLock ?? false;
  const alreadyInTransaction = options?.alreadyInTransaction ?? false;

  return {
    async reconcile(): Promise<void> {
      const schemaName = client.dbScope.schema;
      const declared = schema._declared;

      if (!skipAdvisoryLock) {
        await client.query(advisoryLockSql());
      }
      try {
        await client.run(createSchemaSql(schemaName));

        const catalog = await readPostgresCatalog(client, declared);
        const plan = planServer(declared, catalog);
        if (!plan.ok) {
          const detail = plan.drift
            .map((d) => `${d.path}: ${d.message}`)
            .join('\n');
          throw new Error(`db-schema postgres reconcile drift:\n${detail}`);
        }

        const tableOps = plan.operations.filter(
          (o) => o.kind === 'create_table' || o.kind === 'add_column'
        );
        const indexOps = plan.operations.filter(
          (o) => o.kind === 'create_index' || o.kind === 'drop_index'
        );

        if (tableOps.length > 0) {
          const runTableOps = async (tx: PostgresSqlClient): Promise<void> => {
            for (const op of tableOps) {
              await tx.run(emitServerOperation(op));
            }
          };
          if (alreadyInTransaction) {
            await runTableOps(client);
          } else {
            await client.transaction(async (tx) => {
              await runTableOps(Object.assign(tx, { dbScope: client.dbScope }));
            });
          }
        }

        // CREATE INDEX CONCURRENTLY cannot run inside a transaction.
        const concurrently = !alreadyInTransaction;
        for (const op of indexOps) {
          await runIndexOp(client, op, concurrently);
        }
      } finally {
        if (!skipAdvisoryLock) {
          await client.query(advisoryUnlockSql());
        }
      }
    },
  };
}
