import type {
  Sqlite3Static,
  WasmDatabase,
} from '@pkgs/sql-client-sqlite-web-shared-ts/oo1-sql-client';
import { Oo1SqlClient } from '@pkgs/sql-client-sqlite-web-shared-ts/oo1-sql-client';
import type {
  SqliteWorkerBackend,
  SqliteWorkerOpenedDatabase,
} from '@pkgs/sql-client-sqlite-web-shared-ts/sqlite-worker-host';
import { assertDatabaseName } from '@pkgs/sql-root-shared-ts/assert-database-name';

type SahPoolUtil = Awaited<ReturnType<Sqlite3Static['installOpfsSAHPoolVfs']>>;

/** Root OPFS directory holding one SAH-pool directory per database. */
export const OPFS_SAH_POOL_ROOT = '/sqlite-web';

/**
 * Pool capacity: main file + journal + temp, with headroom. Only applies when
 * the pool is first created (persisted afterwards).
 */
const INITIAL_POOL_CAPACITY = 6;

export function opfsSahPoolDirectory(dbName: string): string {
  assertDatabaseName(dbName);
  return `${OPFS_SAH_POOL_ROOT}/${dbName}`;
}

export function opfsSahPoolVfsName(dbName: string): string {
  assertDatabaseName(dbName);
  return `sahpool-${dbName}`;
}

function poolDbFilename(dbName: string): string {
  return `/${dbName}.sqlite3`;
}

/**
 * Persistent backend on the OPFS SyncAccessHandle pool VFS. One VFS + one
 * directory per database so `wipe` can drop exactly that database's files.
 *
 * The pool VFS is exclusive per directory; the owner broker guarantees a
 * single owner tab, and terminating this worker releases every handle.
 */
export class OpfsSahPoolBackend implements SqliteWorkerBackend {
  private pools = new Map<string, SahPoolUtil>();

  constructor(private readonly sqlite3: Sqlite3Static) {}

  private async pool(dbName: string): Promise<SahPoolUtil> {
    const existing = this.pools.get(dbName);
    if (existing !== undefined) return existing;
    const util = await this.sqlite3.installOpfsSAHPoolVfs({
      directory: opfsSahPoolDirectory(dbName),
      name: opfsSahPoolVfsName(dbName),
      initialCapacity: INITIAL_POOL_CAPACITY,
    });
    this.pools.set(dbName, util);
    return util;
  }

  async open(dbName: string): Promise<SqliteWorkerOpenedDatabase> {
    const util = await this.pool(dbName);
    const filename = poolDbFilename(dbName);
    const openDb = (): WasmDatabase => new util.OpfsSAHPoolDb(filename);
    const db = new Oo1SqlClient({
      sqlite3: this.sqlite3,
      db: openDb(),
      reopenFromBytes: async (bytes) => {
        await util.importDb(filename, bytes);
        return openDb();
      },
    });
    return { db, persistent: true, vfs: opfsSahPoolVfsName(dbName) };
  }

  async wipe(dbName: string): Promise<void> {
    const util = await this.pool(dbName);
    await util.wipeFiles();
  }
}

type OpfsGlobals = {
  readonly navigator?: {
    readonly storage?: { readonly getDirectory?: unknown };
  };
  readonly FileSystemFileHandle?: { readonly prototype: object };
};

/** True when this (worker) realm exposes OPFS with sync access handles. */
export function isOpfsSahPoolSupported(
  realm: OpfsGlobals = globalThis
): boolean {
  return (
    typeof realm.navigator?.storage?.getDirectory === 'function' &&
    realm.FileSystemFileHandle !== undefined &&
    'createSyncAccessHandle' in realm.FileSystemFileHandle.prototype
  );
}
