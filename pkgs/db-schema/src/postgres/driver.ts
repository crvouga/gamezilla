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

export type PostgresDriver = {
  reconcile(): Promise<void>;
};

type IndexOp = Extract<
  ServerOperation,
  { kind: 'create_index' | 'drop_index' }
>;

async function runIndexOp(
  client: PostgresSqlClient,
  op: IndexOp
): Promise<void> {
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
  client: PostgresSqlClient
): PostgresDriver {
  return {
    async reconcile(): Promise<void> {
      const schemaName = client.dbScope.schema;
      const declared = schema._declared;

      await client.query(advisoryLockSql());
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
          await client.transaction(async (tx) => {
            for (const op of tableOps) {
              await tx.run(emitServerOperation(op));
            }
          });
        }

        // CREATE INDEX CONCURRENTLY cannot run inside a transaction.
        for (const op of indexOps) {
          await runIndexOp(client, op);
        }
      } finally {
        await client.query(advisoryUnlockSql());
      }
    },
  };
}
