// @io-wall-ok — browser page entry for the iframe-hosted expo-sqlite owner

import {
  openDatabaseAsync,
  type SQLiteBindValue,
  type SQLiteDatabase,
} from 'expo-sqlite';

/** OPFS directory AccessHandlePoolVFS uses (`VFS_NAME_PERSISTENT` in expo-sqlite). */
const OPFS_POOL_DIR = 'expo-sqlite';

export type SqlHostRunResult = {
  readonly lastInsertRowId: number;
  readonly changes: number;
};

export type SqlHostApi = {
  open: (dbName: string) => Promise<void>;
  close: () => Promise<void>;
  query: (
    sql: string,
    values?: readonly unknown[]
  ) => Promise<Record<string, unknown>[]>;
  run: (sql: string, values?: readonly unknown[]) => Promise<SqlHostRunResult>;
  resetStore: () => Promise<void>;
};

/**
 * expo-sqlite spawns its wa-sqlite worker internally and never exposes it, so
 * we record every worker this document creates. Terminating them is the only
 * way to release AccessHandlePoolVFS sync handles without unloading the page.
 */
const spawnedWorkers = new Set<Worker>();

function captureSpawnedWorkers(): void {
  const NativeWorker = globalThis.Worker;
  class CapturedWorker extends NativeWorker {
    constructor(scriptURL: string | URL, options?: WorkerOptions) {
      super(scriptURL, options);
      spawnedWorkers.add(this);
    }
    override terminate(): void {
      spawnedWorkers.delete(this);
      super.terminate();
    }
  }
  globalThis.Worker = CapturedWorker;
}

function terminateSpawnedWorkers(): void {
  for (const worker of [...spawnedWorkers]) {
    worker.terminate();
  }
  spawnedWorkers.clear();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function wipeDirectoryChildren(
  dir: FileSystemDirectoryHandle
): Promise<void> {
  const names: string[] = [];
  for await (const [name] of dir.entries()) {
    names.push(name);
  }
  for (const name of names) {
    try {
      await dir.removeEntry(name, { recursive: true });
    } catch {
      // Child may still be locked; parent remove reports failure.
    }
  }
}

/**
 * Drop the OPFS pool directory. After AccessHandlePoolVFS sync handles are
 * released (worker terminate), Chrome may still report NoModificationAllowed
 * for a tick — retry briefly before failing.
 */
async function removeOpfsPoolDir(): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.storage === undefined) {
    return;
  }
  const root = await navigator.storage.getDirectory();
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      try {
        const dir = await root.getDirectoryHandle(OPFS_POOL_DIR);
        await wipeDirectoryChildren(dir);
      } catch (error: unknown) {
        const name = error instanceof DOMException ? error.name : '';
        if (name === 'NotFoundError') return;
      }
      // removeEntry can hang indefinitely while sync access handles are held —
      // never wait forever.
      await Promise.race([
        root.removeEntry(OPFS_POOL_DIR, { recursive: true }),
        sleep(500).then(() => {
          throw new DOMException('OPFS removeEntry timed out', 'TimeoutError');
        }),
      ]);
      return;
    } catch (error: unknown) {
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotFoundError') return;
      lastError = error;
      await sleep(25 * (attempt + 1));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('sql-host: failed to remove OPFS pool directory');
}

function createSqlHost(): SqlHostApi {
  let db: SQLiteDatabase | null = null;

  const requireDb = (): SQLiteDatabase => {
    if (db === null) throw new Error('sql-host: open() was not called');
    return db;
  };

  /**
   * Best-effort close. Never block recovery on closeAsync — the dedicated
   * worker can hang after OPFS errors, and terminateSpawnedWorkers is what
   * actually releases AccessHandlePoolVFS sync handles.
   */
  const close = async (): Promise<void> => {
    const open = db;
    db = null;
    if (open === null) return;
    try {
      await Promise.race([open.closeAsync(), sleep(250).then(() => undefined)]);
    } catch {
      // Ignored — worker terminate follows for wipe paths.
    }
  };

  return {
    open: async (dbName: string) => {
      await close();
      terminateSpawnedWorkers();
      db = await openDatabaseAsync(dbName);
    },
    close,
    query: async (sql, values = []) =>
      requireDb().getAllAsync<Record<string, unknown>>(sql, [
        ...values,
      ] as SQLiteBindValue[]),
    run: async (sql, values = []) => {
      const result = await requireDb().runAsync(sql, [
        ...values,
      ] as SQLiteBindValue[]);
      return {
        lastInsertRowId: result.lastInsertRowId,
        changes: result.changes,
      };
    },
    resetStore: async () => {
      // Drop the handle first; do not await a stuck closeAsync.
      db = null;
      terminateSpawnedWorkers();
      await sleep(50);
      await removeOpfsPoolDir();
      // expo-sqlite's getWorker() keeps a module-level singleton. After we
      // terminate that Worker, open() in this same document would hang on a
      // dead port. Callers must remount this document (iframe recycle or
      // location.reload) before open().
    },
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __sqlHost: SqlHostApi | undefined;
}

captureSpawnedWorkers();
globalThis.__sqlHost = createSqlHost();
window.parent.postMessage({ type: 'ready', source: 'sql-host' }, '*');
