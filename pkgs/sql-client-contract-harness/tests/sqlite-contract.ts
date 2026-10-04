import { afterEach, beforeEach } from 'bun:test';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { registerSqliteDdlTests } from './sqlite-contract-ddl';
import { registerSqliteQueryTests } from './sqlite-contract-query';
import { registerSqliteReturningTests } from './sqlite-contract-returning';
import { registerSqliteTxnTests } from './sqlite-contract-txn';
import { registerSqliteUpsertTests } from './sqlite-contract-upsert';

/** Shared SQLite dialect contract — run against every in-process SqlClient adapter. */
export function runSqliteContractTests(
  factory: () => SqlClient | Promise<SqlClient>
): void {
  let client: SqlClient;

  beforeEach(async () => {
    client = await Promise.resolve(factory());
    await client.connect();
  });

  afterEach(async () => {
    try {
      await client.disconnect();
    } catch {
      // already disconnected
    }
  });

  const getClient = (): SqlClient => client;
  registerSqliteDdlTests(getClient);
  registerSqliteReturningTests(getClient);
  registerSqliteUpsertTests(getClient);
  registerSqliteQueryTests(getClient);
  registerSqliteTxnTests(getClient);
}
