/**
 * Run patch-db migrations against an in-process PGlite instance.
 *
 * The dev DB server boots ephemeral PGlite (in memory), so migrations must run
 * on every startup before requests are served. We don't reuse
 * {@link SqlClientImplPgliteHttp} here because there is no HTTP server yet —
 * the Hono app is mounted only after migrations succeed.
 */

import type { PGlite } from '@electric-sql/pglite';
import { assert } from '@gamezilla/lib/assert';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@gamezilla/lib/sql-client/interface';
import { questionMarkParamsToDollarParams } from '@gamezilla/lib/sql-client/positional-params';
import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';

function createInProcessPgliteSqlClient(db: PGlite): SqlClient {
  const client: SqlClient = {
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: unknown[]
    ): Promise<T[]> {
      const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
      const result = await db.query<T>(
        pgSql,
        pgParams.length > 0 ? pgParams : undefined
      );
      assert.array(result.rows, 'PGlite query result.rows must be an array');
      return result.rows;
    },
    async run(sql: string, params?: unknown[]): Promise<RunResult> {
      const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
      const result = await db.query(
        pgSql,
        pgParams.length > 0 ? pgParams : undefined
      );
      const rows = result.rows as Record<string, unknown>[];
      const changes = result.affectedRows ?? 0;
      assert.nonNegativeInteger(
        changes,
        'PGlite affectedRows must be a non-negative safe integer'
      );
      return { changes, lastInsertRowid: readIdFromFirstRow(rows[0]) };
    },
    prepare(sql: string): PreparedStatement {
      return {
        query: <T = Record<string, unknown>>(params?: unknown[]) =>
          client.query<T>(sql, params),
        run: (params?: unknown[]) => client.run(sql, params),
      };
    },
    transaction: (fn) => fn(client),
  };
  return client;
}

function readIdFromFirstRow(first: Record<string, unknown> | undefined): number {
  if (first === undefined) return 0;
  const id = first['id'];
  if (typeof id === 'number' && Number.isInteger(id)) return id;
  if (typeof id === 'bigint') return Number(id);
  if (typeof id === 'string') return parseInt(id, 10) || 0;
  return 0;
}

export async function migrateInProcessPglite(db: PGlite): Promise<void> {
  const patchDb = new PatchDbImplPostgres(createInProcessPgliteSqlClient(db));
  await patchDb.migrate();
}
