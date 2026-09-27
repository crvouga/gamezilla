import type { SqlClient } from '@pkgs/sql-client/interface';
import { createMemorySqlOwner } from '@pkgs/sql-client-sqlite-web/owners/memory-sql-owner';
import {
  createSimOpfsSqlOwner,
  type SimOpfsStore,
} from '@pkgs/sql-client-sqlite-web/owners/sim-opfs-sql-owner';
import type { SqlOwner } from '@pkgs/sql-client-sqlite-web/sql-owner';
import { requireStore, SIM_DB_NAME, type SqlClientWebState } from './types';

type SnapshottingClient = SqlClient & {
  exportDatabaseBytes?: () => Uint8Array;
  importDatabaseBytes?: (bytes: Uint8Array) => void;
};

/**
 * Durable bytes live on the shared store, not on a tab, so whichever tab the
 * broker elects next restores the same database.
 */
export function persistImage(
  state: SqlClientWebState,
  client: SqlClient
): void {
  const snapshotting = client as SnapshottingClient;
  if (typeof snapshotting.exportDatabaseBytes !== 'function') return;
  requireStore(state).image = snapshotting.exportDatabaseBytes();
}

/** `mockingbird-sqlite` backend: no pool model, but the same durable-image semantics. */
function memoryBackedOwner(store: SimOpfsStore): SqlOwner {
  const inner = createMemorySqlOwner({ dbName: SIM_DB_NAME });
  return {
    open: async () => {
      const client = (await inner.open()) as SnapshottingClient;
      const image = store.image;
      if (image !== null && typeof client.importDatabaseBytes === 'function') {
        client.importDatabaseBytes(image);
      }
      return client;
    },
    close: () => inner.close(),
    release: () => inner.release(),
    resetStore: async () => {
      store.image = null;
      store.corrupt = false;
      await inner.resetStore();
    },
  };
}

/**
 * Backing owner for one tab. Any wipe — explicit or via in-process recovery —
 * clears the harness belief about durable rows so invariants stay exact.
 */
export function createTabOwner(state: SqlClientWebState): SqlOwner {
  const store = requireStore(state);
  const inner =
    state.backend === 'mockingbird-sqlite'
      ? memoryBackedOwner(store)
      : createSimOpfsSqlOwner({ dbName: SIM_DB_NAME, store });
  return {
    open: () => inner.open(),
    close: () => inner.close(),
    release: () => inner.release(),
    resetStore: async () => {
      state.wipes += 1;
      state.expected.clear();
      state.appliedEpoch = 0;
      await inner.resetStore();
    },
  };
}
