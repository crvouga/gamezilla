import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';
import type { SqlOwner } from '../sql-owner';

/**
 * In-process memory {@link SqlOwner} for Happy DOM / DST / matrix tests.
 * `resetStore` drops the live client so the next `open` is empty.
 */
export function createMemorySqlOwner(args: {
  readonly dbName: string;
}): SqlOwner {
  let client: SqlClientImplMockingbirdSqlite | null = null;
  void args.dbName;

  return {
    open: async () => {
      if (client !== null) {
        try {
          await client.disconnect();
        } catch {
          // ignore
        }
      }
      client = SqlClientImplMockingbirdSqlite.open();
      await client.connect();
      return client;
    },
    close: async () => {
      if (client === null) return;
      try {
        await client.disconnect();
      } catch {
        // ignore
      }
      client = null;
    },
    // In-process: nothing outlives the page.
    release: () => undefined,
    resetStore: async () => {
      if (client !== null) {
        try {
          await client.disconnect();
        } catch {
          // ignore
        }
        client = null;
      }
    },
  };
}

export function isMemorySqlClient(client: SqlClient): boolean {
  return client instanceof SqlClientImplMockingbirdSqlite;
}
