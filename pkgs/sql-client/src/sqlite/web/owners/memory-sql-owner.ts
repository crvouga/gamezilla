import type { SqlClient } from '../../../interface';
import { SqlClientImplSqliteMem } from '../../impl-sqlite-mem';
import type { SqlOwner } from '../sql-owner';

/**
 * In-process memory {@link SqlOwner} for Happy DOM / DST / matrix tests.
 * `resetStore` drops the live client so the next `open` is empty.
 */
export function createMemorySqlOwner(args: {
  readonly dbName: string;
}): SqlOwner {
  let client: SqlClientImplSqliteMem | null = null;
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
      client = SqlClientImplSqliteMem.open();
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
  return client instanceof SqlClientImplSqliteMem;
}
