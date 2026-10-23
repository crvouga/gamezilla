/**
 * better-sqlite3 for Jest / Node product simulations. Bun-native tests use
 * {@link SqlClientImplBunSqlite}; web apps use the `@pkgs/sql-client-sqlite-web` client.
 */

import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client-root-shared-ts/interface';
import { applySqliteConnectionPragmas } from '@pkgs/sql-client-sqlite-root-shared-ts/connection-pragmas';
import type { Sql, Value } from '@pkgs/sql-root-shared-ts/sql';
import BetterSqlite3 from 'better-sqlite3';

/**
 * better-sqlite3 rejects `boolean` / `undefined`. Domain SQL binds JS booleans
 * for INTEGER columns (e.g. `join_announced`); coerce at the engine boundary.
 */
function toBetterSqliteBinds(values: readonly Value[]): unknown[] {
  return values.map((value) => {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
}

import { createTransactionChain } from '@pkgs/sql-client-sqlite-root-shared-ts/transaction-chain';

export class SqlClientImplBetterSqlite implements SqlClient {
  private readonly enqueueTxn = createTransactionChain();

  constructor(private db: BetterSqlite3.Database) {}

  static open(databasePath: string): SqlClientImplBetterSqlite {
    return new SqlClientImplBetterSqlite(new BetterSqlite3(databasePath));
  }

  /** Ephemeral in-memory DB (harness / Jest clients). */
  static openMemory(): SqlClientImplBetterSqlite {
    return new SqlClientImplBetterSqlite(new BetterSqlite3(':memory:'));
  }

  /** Restore from a prior {@link serializeBytes} image. */
  static openFromBytes(bytes: Uint8Array): SqlClientImplBetterSqlite {
    return new SqlClientImplBetterSqlite(new BetterSqlite3(Buffer.from(bytes)));
  }

  /** Native sqlite image for DST frame dumps (`Database.serialize()`). */
  serializeBytes(): Uint8Array {
    return new Uint8Array(this.db.serialize());
  }

  /** Replace live contents from a serialize image (keeps this handle). */
  importBytes(bytes: Uint8Array): void {
    this.db.close();
    this.db = new BetterSqlite3(Buffer.from(bytes));
  }

  async connect(): Promise<void> {
    try {
      this.db.prepare('SELECT 1').get();
      await applySqliteConnectionPragmas(this);
    } catch (err) {
      assert.ok(false, 'Database connection failed', { error: err });
    }
  }

  disconnect(): Promise<void> {
    try {
      this.db.close();
      return Promise.resolve();
    } catch (err) {
      assert.ok(false, 'Database disconnection failed', { error: err });
    }
  }

  query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
    const rows = this.db
      .prepare(query.sql)
      .all(...toBetterSqliteBinds(query.values)) as T[];
    return Promise.resolve(rows);
  }

  run(query: Sql<unknown>): Promise<RunResult> {
    const result = this.db
      .prepare(query.sql)
      .run(...toBetterSqliteBinds(query.values));
    return Promise.resolve({
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid),
    });
  }

  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> {
    const stmt = this.db.prepare(query.sql);
    return {
      query: <R = Record<string, unknown>>(params?: Value[]) => {
        return Promise.resolve(
          stmt.all(...toBetterSqliteBinds(params ?? [])) as R[]
        );
      },
      run: (params?: Value[]) => {
        const result = stmt.run(...toBetterSqliteBinds(params ?? []));
        return Promise.resolve({
          changes: Number(result.changes),
          lastInsertRowid: Number(result.lastInsertRowid),
        });
      },
    };
  }

  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return this.enqueueTxn(() => this.execTransaction(fn));
  }

  private async execTransaction<T>(
    fn: (tx: SqlClient) => Promise<T>
  ): Promise<T> {
    this.db.exec('BEGIN');
    try {
      const result = await fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
}
