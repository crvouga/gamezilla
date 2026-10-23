import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { classify, hasReturningClause } from './classify';
import { FRAMEWORK_TABLE_NAMES } from './framework-server-ddl';
import { injectManagedColumns } from './inject-managed-columns';
import type { MutationDb, MutationEnv } from './mutations-types';
import { MutationError } from './mutations-types';
import type { QueryRow } from './v2';
import type { WriteCaptureBag, WriteCaptureSnapshot } from './write-capture';
import { createWriteCaptureBag } from './write-capture';

const FRAMEWORK_TABLE_SET: ReadonlySet<string> = new Set(FRAMEWORK_TABLE_NAMES);

/** Non-domain tables writable from mutations that must not get managed columns. */
const NON_DOMAIN_WRITE_TABLES: ReadonlySet<string> = new Set([
  ...FRAMEWORK_TABLE_NAMES,
  'outbox_events',
  'outbox_deliveries',
]);

export type WrappedMutationDb = {
  readonly tx: MutationDb;
  readonly getCapture: () => WriteCaptureSnapshot;
};

function withReturning(query: Sql<unknown>): Sql<QueryRow> {
  if (hasReturningClause(query)) {
    return query as Sql<QueryRow>;
  }
  return sql<QueryRow>`${query} RETURNING *`;
}

/**
 * Wrap mutation tx: AST classify, NO_HARD_DELETE, managed-column inject,
 * RETURNING capture. Domain hard DELETE → MutationError. Captured writes feed
 * fanout + topic map.
 */
export function wrapMutationDb(
  tx: MutationDb,
  env: MutationEnv
): WrappedMutationDb {
  const capture: WriteCaptureBag = createWriteCaptureBag();

  async function execWrite(
    query: Sql<unknown>,
    table: string,
    op: 'insert' | 'upsert' | 'update'
  ): Promise<QueryRow[]> {
    capture.touch(table);
    const injected = NON_DOMAIN_WRITE_TABLES.has(table)
      ? query
      : injectManagedColumns(query, env, op);
    const returning = withReturning(injected);
    const rows = await tx.query(returning);
    if (rows.length > 0) {
      capture.addImages(table, rows as QueryRow[]);
    }
    return rows as QueryRow[];
  }

  const wrapped: MutationDb = {
    query: async (query) => {
      const classified = classify(query);
      if (classified.kind === 'delete') {
        if (!FRAMEWORK_TABLE_SET.has(classified.table)) {
          throw new MutationError(
            'NO_HARD_DELETE',
            `Hard DELETE FROM ${classified.table} is forbidden; set deleted_at instead.`,
            { table: classified.table }
          );
        }
        return tx.query(query);
      }
      if (classified.kind === 'write') {
        return (await execWrite(
          query,
          classified.table,
          classified.op
        )) as never;
      }
      return tx.query(query);
    },
    run: async (query) => {
      const classified = classify(query);
      if (classified.kind === 'delete') {
        if (!FRAMEWORK_TABLE_SET.has(classified.table)) {
          throw new MutationError(
            'NO_HARD_DELETE',
            `Hard DELETE FROM ${classified.table} is forbidden; set deleted_at instead.`,
            { table: classified.table }
          );
        }
        return tx.run(query);
      }
      if (classified.kind === 'write') {
        await execWrite(query, classified.table, classified.op);
        return { changes: 0, lastInsertRowid: 0 };
      }
      if (
        classified.kind === 'other' &&
        classified.reason.startsWith('parse_error')
      ) {
        const head = query.sql.trimStart().slice(0, 6).toUpperCase();
        if (head.startsWith('INSERT') || head.startsWith('UPDATE')) {
          throw new MutationError(
            'UNCLASSIFIABLE_SQL',
            `Mutation SQL could not be classified: ${classified.reason}`,
            { reason: classified.reason }
          );
        }
      }
      return tx.run(query);
    },
  };

  return {
    tx: wrapped,
    getCapture: () => capture.snapshot(),
  };
}
