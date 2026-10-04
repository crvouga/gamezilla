import type { Sql, Value } from '@pkgs/sql-shared/sql';
import type {
  PostgresSqlClient,
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client-shared/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';

export type RecordedCall =
  | {
      readonly kind: 'query';
      readonly sql: string;
      readonly values: readonly Value[];
    }
  | {
      readonly kind: 'run';
      readonly sql: string;
      readonly values: readonly Value[];
    };

export type RecordingSqlClient = SqlClient & {
  readonly calls: RecordedCall[];
  readonly runCalls: RecordedCall[];
  clear(): void;
};

export function createRecordingSqlClient(
  inner?: Partial<SqlClient>
): RecordingSqlClient {
  const calls: RecordedCall[] = [];
  const client: RecordingSqlClient = {
    calls,
    get runCalls() {
      return calls.filter((c) => c.kind === 'run');
    },
    clear() {
      calls.length = 0;
    },
    async connect() {
      await inner?.connect?.();
    },
    async disconnect() {
      await inner?.disconnect?.();
    },
    async query<T extends Record<string, unknown>>(
      query: Sql<T>
    ): Promise<T[]> {
      calls.push({ kind: 'query', sql: query.sql, values: query.values });
      if (inner?.query) return inner.query(query);
      return [];
    },
    async run(query: Sql<unknown>): Promise<RunResult> {
      calls.push({ kind: 'run', sql: query.sql, values: query.values });
      if (inner?.run) return inner.run(query);
      return { changes: 0, lastInsertRowid: 0 };
    },
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      if (inner?.transaction) return inner.transaction(fn);
      return fn(client);
    },
    prepare<T extends Record<string, unknown>>(
      query: Sql<T>
    ): PreparedStatement<T> {
      if (inner?.prepare) return inner.prepare(query);
      return {
        query: async () => [],
        run: async () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    },
  };
  return client;
}

export function createRecordingPostgresClient(
  dbScope: PostgresDbScope,
  inner?: Partial<SqlClient>
): PostgresSqlClient & RecordingSqlClient {
  const base = createRecordingSqlClient(inner);
  return Object.assign(base, { dbScope }) as PostgresSqlClient &
    RecordingSqlClient;
}
