import type { SqlClient } from '../../../interface';
import { SqlClientImplSqliteMem } from '../../impl-sqlite-mem';
import type { SqlOwner } from '../sql-owner';

/**
 * Simulated AccessHandlePoolVFS for DST / Happy DOM.
 * Capacity defaults to 6 (expo-sqlite web). Extra associated paths or a
 * corrupted image throw the same messages production surfaces.
 */
export type SimOpfsStore = {
  readonly capacity: number;
  /** Associated OPFS-like paths currently holding pool slots. */
  paths: Set<string>;
  /** When set, open throws "file is not a database". */
  corrupt: boolean;
  /** Optional bytes image restored after a successful open (mem snapshot). */
  image: Uint8Array | null;
};

export function createSimOpfsStore(args?: {
  readonly capacity?: number;
}): SimOpfsStore {
  return {
    capacity: args?.capacity ?? 6,
    paths: new Set(),
    corrupt: false,
    image: null,
  };
}

export function fillSimOpfsPool(store: SimOpfsStore): void {
  store.paths.clear();
  for (let i = 0; i < store.capacity; i++) {
    store.paths.add(`junk_${i}`);
  }
}

export function corruptSimOpfsStore(store: SimOpfsStore): void {
  store.corrupt = true;
}

/**
 * Memory SQL behind a simulated OPFS pool. `open` associates `dbName` with a
 * pool slot (or throws `cannot create file` / corrupt errors). `resetStore`
 * clears the whole pool like wiping `expo-sqlite/`.
 */
export function createSimOpfsSqlOwner(args: {
  readonly dbName: string;
  readonly store: SimOpfsStore;
}): SqlOwner {
  let client: SqlClientImplSqliteMem | null = null;
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
        // Match expo worker wrap of pool exhaustion.
        if (
          error instanceof Error &&
          /cannot create file/i.test(error.message)
        ) {
          throw new Error('Error: sqlite3_open_v2', { cause: error });
        }
        throw error;
      }
      client = SqlClientImplSqliteMem.open();
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

export function isSimOpfsSqlClient(client: SqlClient): boolean {
  return client instanceof SqlClientImplSqliteMem;
}
