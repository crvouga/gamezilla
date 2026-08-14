/**
 * Kysely SQLite dialect backed by {@link SqlClient} (better-sqlite3, expo-sqlite, …).
 * Used by Better Auth in browser / Expo web sims where native better-sqlite3 is unavailable.
 */

import { Sql, sql, type Value } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  type CompiledQuery,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type Driver,
  type Kysely,
  type QueryResult,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type TransactionSettings,
} from 'kysely';

function sqlFromCompiled(
  compiled: CompiledQuery
): Sql<Record<string, unknown>> {
  const strings = compiled.sql.split('?');
  return new Sql(strings, compiled.parameters as readonly Value[]);
}

function createConnection(client: SqlClient): DatabaseConnection {
  return {
    async executeQuery<R>(
      compiledQuery: CompiledQuery
    ): Promise<QueryResult<R>> {
      const query = sqlFromCompiled(compiledQuery);
      const isSelect =
        /^\s*(select|pragma|with)\b/i.test(compiledQuery.sql) ||
        /\breturning\b/i.test(compiledQuery.sql);
      if (isSelect) {
        const rows = await client.query(query);
        return { rows: rows as R[] };
      }
      const result = await client.run(query);
      return {
        rows: [] as R[],
        numAffectedRows: BigInt(result.changes),
        ...(result.lastInsertRowid === 0
          ? {}
          : { insertId: BigInt(result.lastInsertRowid) }),
      };
    },
    streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
      throw new Error('SqlClientConnection: streamQuery is not supported');
    },
  };
}

function createDriver(client: SqlClient): Driver {
  let connection: DatabaseConnection | null = null;
  return {
    async init(): Promise<void> {
      connection = createConnection(client);
    },
    async acquireConnection(): Promise<DatabaseConnection> {
      if (connection === null) {
        throw new Error('SqlClientDriver: not initialized');
      }
      return connection;
    },
    async beginTransaction(
      _connection: DatabaseConnection,
      _settings: TransactionSettings
    ): Promise<void> {
      await client.run(sql`BEGIN`);
    },
    async commitTransaction(_connection: DatabaseConnection): Promise<void> {
      await client.run(sql`COMMIT`);
    },
    async rollbackTransaction(_connection: DatabaseConnection): Promise<void> {
      await client.run(sql`ROLLBACK`);
    },
    async releaseConnection(): Promise<void> {
      // Single shared SqlClient — nothing to release.
    },
    async destroy(): Promise<void> {
      connection = null;
    },
  };
}

export type SqlClientSqliteDialectConfig = {
  readonly client: SqlClient;
};

/** Kysely dialect that executes through an injected {@link SqlClient}. */
export class SqlClientSqliteDialect implements Dialect {
  readonly #client: SqlClient;

  constructor(config: SqlClientSqliteDialectConfig) {
    this.#client = config.client;
  }

  createDriver(): Driver {
    return createDriver(this.#client);
  }

  createQueryCompiler(): SqliteQueryCompiler {
    return new SqliteQueryCompiler();
  }

  createAdapter(): SqliteAdapter {
    return new SqliteAdapter();
  }

  createIntrospector(db: Kysely<unknown>): DatabaseIntrospector {
    return new SqliteIntrospector(db);
  }
}
