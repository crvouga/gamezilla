import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import type { SqlOwner } from './sql-owner';

/**
 * Simulated AccessHandlePoolVFS for DST / Happy DOM.
 * Capacity defaults to 6 (web SQLite). Extra associated paths or a
 * corrupted image throw the same messages production surfaces.
 */
export type HarnessOpfsStore = {
  readonly capacity: number;
  /** Associated OPFS-like paths currently holding pool slots. */
  paths: Set<string>;
  /** When set, open throws "file is not a database". */
  corrupt: boolean;
  /** Optional bytes image restored after a successful open (mem snapshot). */
  image: Uint8Array | null;
};

export function createHarnessOpfsStore(args?: {
  readonly capacity?: number;
}): HarnessOpfsStore {
  return {
    capacity: args?.capacity ?? 6,
    paths: new Set(),
    corrupt: false,
    image: null,
  };
}

export function fillHarnessOpfsPool(store: HarnessOpfsStore): void {
  store.paths.clear();
  for (let i = 0; i < store.capacity; i++) {
    store.paths.add(`junk_${i}`);
  }
}

export function corruptHarnessOpfsStore(store: HarnessOpfsStore): void {
  store.corrupt = true;
}

/**
 * Memory SQL behind a simulated OPFS pool. `open` associates `dbName` with a
 * pool slot (or throws `cannot create file` / corrupt errors). `resetStore`
 * clears the whole pool like wiping the SQLite pool dir.
 */
export function createHarnessOpfsSqlOwner(args: {
  readonly dbName: string;
  readonly store: HarnessOpfsStore;
}): SqlOwner {
  let client: SqlClientImplMockingbirdSqlite | null = null;
  const { dbName, store } = args;

  function associate(): void {
    if (store.corrupt) {
      throw new Error('file is not a database');
    }
    if (store.paths.has(dbName)) {
      return;
    }
    if (store.paths.size >= store.capacity) {
      throw new Error('cannot create file');
    }
    store.paths.add(dbName);
  }

  return {
    open: async () => {
      if (client !== null) {
        try {
          await client.disconnect();
        } catch {
          // ignore
        }
        client = null;
      }
      try {
        associate();
      } catch (error: unknown) {
        // Match the web worker wrap of pool exhaustion.
        if (
          error instanceof Error &&
          /cannot create file/i.test(error.message)
        ) {
          throw new Error(`Error: sqlite3_open_v2 (${error.message})`, {
            cause: error,
          });
        }
        throw error;
      }
      client = SqlClientImplMockingbirdSqlite.open();
      await client.connect();
      if (store.image !== null) {
        client.importDatabaseBytes(store.image);
      }
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
      // Simulates iframe teardown: release this path's association but leave
      // other junk files (fillPool leftovers) until resetStore.
      store.paths.delete(dbName);
    },
    release: () => {
      client = null;
      store.paths.delete(dbName);
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
      store.paths.clear();
      store.corrupt = false;
      store.image = null;
    },
  };
}

export function isHarnessOpfsSqlClient(client: SqlClient): boolean {
  return client instanceof SqlClientImplMockingbirdSqlite;
}
