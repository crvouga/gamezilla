import type { ServerOperation } from '@pkgs/db-schema/core/operations';
import { planServer } from '@pkgs/db-schema/core/plan';
import type { Schema } from '@pkgs/db-schema/core/types';
import { ident, join, raw, sql } from '@pkgs/sql';
import type { PostgresSqlClient, SqlClient } from '@pkgs/sql-client/interface';
import {
  advisoryLockSql,
  advisoryUnlockSql,
  createSchemaSql,
  readPostgresCatalog,
} from './catalog';
import { emitServerOperation, isConcurrentlyUnsupportedError } from './emit';

/** Rows per backfill batch (bounded row locks, cursor-monotone). */
export const BACKFILL_BATCH_ROWS = 1000;

export type PostgresDriverOptions = {
  /**
   * Skip the package session advisory lock when the caller already holds a
   * migrate mutex (e.g. `pg_advisory_xact_lock` in api migrate).
   */
  readonly skipAdvisoryLock?: boolean;
  /**
   * When true, run table DDL on the injected client without opening a nested
   * transaction (caller already provides a transaction).
   */
  readonly alreadyInTransaction?: boolean;
  /**
   * `inline` (default): reconcile tables and indexes here, CONCURRENTLY when
   * not nested. `skip`: table DDL only — a separate phase owns indexes.
   * `only`: index DDL only, always outside a transaction.
   */
  readonly indexPhase?: 'inline' | 'skip' | 'only';
};

export type PostgresDriver = {
  reconcile(): Promise<void>;
};

type IndexOp = Extract<
  ServerOperation,
  { kind: 'create_index' | 'drop_index' }
>;

const TABLE_TX_KINDS = new Set<ServerOperation['kind']>([
  'create_table',
  'add_column',
  'backfill',
]);

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
 * Backfill in bounded PK-cursor batches. A full-table `UPDATE` holds a row lock
 * per matching row for the whole statement; batching keeps each lock window
 * small. The cursor is monotone on `id`, so an expression that yields NULL
 * still terminates instead of re-selecting the same rows forever.
 */
async function runBatchedBackfill(
  client: SqlClient,
  table: string,
  column: string,
  expression: string
): Promise<void> {
  let cursor: string | null = null;
  for (;;) {
    const batch: readonly { id: string }[] =
      cursor === null
        ? await client.query<{ id: string }>(
            sql`SELECT id FROM ${ident(table)} WHERE ${ident(column)} IS NULL ORDER BY id LIMIT ${BACKFILL_BATCH_ROWS}`
          )
        : await client.query<{ id: string }>(
            sql`SELECT id FROM ${ident(table)} WHERE ${ident(column)} IS NULL AND id > ${cursor} ORDER BY id LIMIT ${BACKFILL_BATCH_ROWS}`
          );
    if (batch.length === 0) return;
    const ids: string[] = batch.map((row) => row.id);
    await client.run(
      sql`UPDATE ${ident(table)} SET ${ident(column)} = ${raw(expression)} WHERE id IN (${join(
        ids.map((id) => sql`${id}`),
        ', '
      )}) AND ${ident(column)} IS NULL`
    );
    cursor = ids[ids.length - 1]!;
  }
}

/**
 * Postgres schema reconciler. Non-destructive by construction: only create
 * table / add column / backfill / create|drop package-prefixed indexes.
 * Never DROP TABLE/COLUMN, ALTER TYPE, or RENAME.
 */
export function postgres(
  schema: Schema,
  client: PostgresSqlClient,
  options?: PostgresDriverOptions
): PostgresDriver {
  const skipAdvisoryLock = options?.skipAdvisoryLock ?? false;
  const alreadyInTransaction = options?.alreadyInTransaction ?? false;
  const indexPhase = options?.indexPhase ?? 'inline';
  const planSelection =
    indexPhase === 'only' ? 'index' : indexPhase === 'skip' ? 'table' : 'all';

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
        const plan = planServer(declared, catalog, {
          operations: planSelection,
        });
        if (!plan.ok) {
          const detail = plan.drift
            .map((d) => `${d.path}: ${d.message}`)
            .join('\n');
          throw new Error(`db-schema postgres reconcile drift:\n${detail}`);
        }

        const tableOps = plan.operations.filter((o) =>
          TABLE_TX_KINDS.has(o.kind)
        );
        const indexOps = plan.operations.filter(
          (o): o is IndexOp =>
            o.kind === 'create_index' || o.kind === 'drop_index'
        );

        if (tableOps.length > 0) {
          const runTableOps = async (tx: SqlClient): Promise<void> => {
            for (const op of tableOps) {
              if (op.kind === 'backfill') {
                await runBatchedBackfill(
                  tx,
                  op.table,
                  op.column,
                  op.expression
                );
                continue;
              }
              await tx.run(emitServerOperation(op, { concurrently: false }));
            }
          };
          if (alreadyInTransaction) {
            await runTableOps(client);
          } else {
            await client.transaction(async (tx) => {
              await runTableOps(tx);
            });
          }
        }

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
