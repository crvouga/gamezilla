import type { Timers } from '@pkgs/clock';
import type { Sql } from '@pkgs/sql';
import type { PreparedStatement, SqlClient } from '../../interface';
import { applySqliteConnectionPragmas } from '../connection-pragmas';
import {
  isLikelyOpfsLockError,
  isLikelyOpfsPoolExhaustedError,
  openWithWaitRetry,
} from '../expo-sqlite-core';
import { publishExpoSqliteWebFatalError } from '../expo-web-recovery';
import {
  type ActiveTx,
  handleOwnerRequest,
  type OwnerHandlerDeps,
} from './owner-handlers';
import {
  createRpcIdFactory,
  type DbChangedNotify,
  RPC_ERROR_TX_ABORTED,
  RPC_ERROR_TX_TIMEOUT,
  type RpcRequest,
  type RpcResponse,
  TX_IDLE_TIMEOUT_MS,
} from './rpc';
import { sqlFromWire } from './sql-wire';

export { sqlFromWire } from './sql-wire';

export type OwnerRuntime = {
  readonly dbName: string;
  open: () => Promise<void>;
  close: () => Promise<void>;
  getClient: () => SqlClient;
  handleRequest: (request: RpcRequest) => Promise<RpcResponse>;
  onChanged: (listener: (notify: DbChangedNotify) => void) => () => void;
  resetDatabase: () => Promise<void>;
  hasActiveTx: () => boolean;
};

type ExpoSqliteClient = SqlClient & {
  getSqliteDatabase: () => {
    getAllAsync: (
      sql: string,
      values: never
    ) => Promise<Record<string, unknown>[]>;
    runAsync: (
      sql: string,
      values: never
    ) => Promise<{ changes: number; lastInsertRowId: number }>;
  };
  prepare: <T extends Record<string, unknown>>(
    query: Sql<T>
  ) => PreparedStatement<T>;
};

function txError(code: string, message: string): Error {
  const error = new Error(message);
  error.name =
    code === RPC_ERROR_TX_TIMEOUT ? 'TxTimeoutError' : 'TxAbortedError';
  (error as Error & { code?: string }).code = code;
  return error;
}

function createAsyncMutex() {
  let tail: Promise<unknown> = Promise.resolve();
  return function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const done = tail.then(fn, fn);
    tail = done.then(
      () => undefined,
      () => undefined
    );
    return done;
  };
}

function createBypassClient(owner: ExpoSqliteClient): SqlClient {
  const db = owner.getSqliteDatabase();
  const tx: SqlClient = {
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    query: <T extends Record<string, unknown>>(query: {
      sql: string;
      values: readonly unknown[];
    }) => db.getAllAsync(query.sql, query.values as never) as Promise<T[]>,
    run: async (query) => {
      const result = await db.runAsync(query.sql, query.values as never);
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowId,
      };
    },
    prepare: (query) => owner.prepare(query),
    transaction: async (fn) => fn(tx),
  };
  return tx;
}

async function recoverOwnerOpfsPool(
  databaseName: string,
  timers: Timers,
  cause: unknown
): Promise<never> {
  const { WEB_OPFS_RECOVERY_RELOAD_KEY } = await import('../expo-sqlite-core');
  const { runWebOpfsRecoveryAndReload } = await import('./opfs-recover');
  const causeMessage = cause instanceof Error ? cause.message : String(cause);
  // One automatic wipe per tab session — looping wipe↔open freezes the app
  // (seen in Cursor's browser and when open keeps failing after an empty wipe).
  try {
    if (sessionStorage.getItem(WEB_OPFS_RECOVERY_RELOAD_KEY) === '1') {
      const err = new Error(
        `SQLite could not open "${databaseName}" after OPFS pool recovery (${causeMessage}). Use Reset local data or reload with ?reset-db=1.`
      );
      publishExpoSqliteWebFatalError(err);
      throw err;
    }
    sessionStorage.setItem(WEB_OPFS_RECOVERY_RELOAD_KEY, '1');
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('after OPFS pool')) {
      throw error;
    }
    // sessionStorage may be unavailable
  }
  // Do not call deleteDatabaseAsync here on web — it can hang forever when the
  // AccessHandlePoolVFS worker is wedged; the wipe document clears OPFS.
  try {
    await runWebOpfsRecoveryAndReload({ timers });
  } catch (error: unknown) {
    const err =
      error instanceof Error
        ? error
        : new Error(
            `SQLite could not open "${databaseName}" after OPFS pool recovery. Use Reset local data or reload with ?reset-db=1.`
          );
    publishExpoSqliteWebFatalError(err);
    throw err;
  }
  return await new Promise<never>(() => {});
}

async function openExpoSqliteForOwner(
  databaseName: string,
  useNewConnection: boolean
): Promise<ExpoSqliteClient> {
  const { SqlClientImplExpoSqlite } = await import('../impl-expo-sqlite');
  const SQLite = await import('expo-sqlite');
  const opts = useNewConnection ? { useNewConnection: true } : {};
  const db = await SQLite.openDatabaseAsync(databaseName, opts);
  return new SqlClientImplExpoSqlite(db);
}

async function openOwnerClient(args: {
  readonly databaseName: string;
  readonly timers: Timers;
}): Promise<ExpoSqliteClient> {
  return await openWithWaitRetry({
    databaseName: args.databaseName,
    timers: args.timers,
    // Never useNewConnection on owner retries — extra handles worsen
    // AccessHandlePoolVFS capacity exhaustion.
    openOnce: () => openExpoSqliteForOwner(args.databaseName, false),
  });
}

class OwnerRuntimeImpl implements OwnerRuntime {
  readonly dbName: string;
  private readonly timers: Timers;
  private client: ExpoSqliteClient | null = null;
  private openPromise: Promise<void> | null = null;
  private readonly stmts = new Map<
    string,
    PreparedStatement<Record<string, unknown>>
  >();
  private readonly nextStmtId = createRpcIdFactory('stmt');
  private readonly nextTxId = createRpcIdFactory('tx');
  private readonly changeListeners = new Set<
    (notify: DbChangedNotify) => void
  >();
  private readonly runExclusive = createAsyncMutex();
  private activeTx: ActiveTx | null = null;
  private txGate: Promise<void> | null = null;

  constructor(args: { readonly dbName: string; readonly timers: Timers }) {
    this.dbName = args.dbName;
    this.timers = args.timers;
  }

  private emitChanged(txId?: string): void {
    const notify: DbChangedNotify = {
      type: 'db-changed',
      dbName: this.dbName,
      ...(txId !== undefined ? { txId } : {}),
    };
    for (const listener of this.changeListeners) listener(notify);
  }

  private touchTxIdle(tx: ActiveTx): void {
    if (tx.idleTimerId !== null) this.timers.clearTimeout(tx.idleTimerId);
    tx.idleTimerId = this.timers.setTimeout(() => {
      void this.abortActiveTx(
        txError(
          RPC_ERROR_TX_TIMEOUT,
          `Transaction ${tx.txId} idle for ${TX_IDLE_TIMEOUT_MS}ms; rolled back`
        )
      );
    }, TX_IDLE_TIMEOUT_MS);
  }

  private async abortActiveTx(error: Error): Promise<void> {
    const tx = this.activeTx;
    if (tx === null) return;
    if (tx.idleTimerId !== null) {
      this.timers.clearTimeout(tx.idleTimerId);
      tx.idleTimerId = null;
    }
    this.activeTx = null;
    try {
      await tx.client.run(sqlFromWire({ sql: 'ROLLBACK', values: [] }));
    } catch {
      // already rolled back / closed
    }
    tx.rejectGate(error);
    this.txGate = null;
  }

  private async ensureOpen(): Promise<ExpoSqliteClient> {
    if (this.client !== null) return this.client;
    if (this.openPromise === null) {
      this.openPromise = (async () => {
        try {
          this.client = await openOwnerClient({
            databaseName: this.dbName,
            timers: this.timers,
          });
        } catch (error: unknown) {
          this.openPromise = null;
          if (
            isLikelyOpfsPoolExhaustedError(error) ||
            isLikelyOpfsLockError(error)
          ) {
            await recoverOwnerOpfsPool(this.dbName, this.timers, error);
          }
          throw error;
        }
        await applySqliteConnectionPragmas(this.client);
      })();
    }
    await this.openPromise;
    if (this.client === null) {
      throw new Error(`Failed to open owner runtime for "${this.dbName}"`);
    }
    return this.client;
  }

  private deps(): OwnerHandlerDeps {
    return {
      timers: this.timers,
      runExclusive: this.runExclusive,
      ensureOpen: () => this.ensureOpen(),
      emitChanged: (txId) => this.emitChanged(txId),
      stmts: this.stmts,
      nextStmtId: this.nextStmtId,
      nextTxId: this.nextTxId,
      touchTxIdle: (tx) => this.touchTxIdle(tx),
      createBypassClient: (owner) =>
        createBypassClient(owner as ExpoSqliteClient),
      resetDatabase: () => this.resetDatabase(),
      getActiveTx: () => this.activeTx,
      setActiveTx: (tx) => {
        this.activeTx = tx;
      },
      getTxGate: () => this.txGate,
      setTxGate: (gate) => {
        this.txGate = gate;
      },
    };
  }

  open(): Promise<void> {
    return this.ensureOpen().then(() => undefined);
  }

  async close(): Promise<void> {
    if (this.activeTx !== null) {
      await this.abortActiveTx(
        txError(RPC_ERROR_TX_ABORTED, 'Transaction aborted: owner closing')
      );
    }
    this.stmts.clear();
    if (this.client !== null) {
      await this.client.disconnect();
      this.client = null;
      this.openPromise = null;
    }
  }

  getClient(): SqlClient {
    if (this.client === null) {
      throw new Error(`Owner runtime for "${this.dbName}" is not open`);
    }
    return this.client;
  }

  handleRequest(request: RpcRequest): Promise<RpcResponse> {
    return handleOwnerRequest(this.deps(), request);
  }

  onChanged(listener: (notify: DbChangedNotify) => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  async resetDatabase(): Promise<void> {
    if (this.activeTx !== null) {
      await this.abortActiveTx(
        txError(RPC_ERROR_TX_ABORTED, 'Transaction aborted by resetDatabase')
      );
    }
    this.stmts.clear();
    if (this.client !== null) {
      await this.client.disconnect();
      this.client = null;
      this.openPromise = null;
    }
    const [SQLite, { clearExpoSqliteWebOpfsBestEffort }] = await Promise.all([
      import('expo-sqlite'),
      import('../clear-expo-sqlite-web-opfs'),
    ]);
    try {
      await SQLite.deleteDatabaseAsync(this.dbName);
    } catch {
      // may not exist
    }
    await clearExpoSqliteWebOpfsBestEffort();
  }

  hasActiveTx(): boolean {
    return this.activeTx !== null;
  }
}

/**
 * Owner-tab runtime: opens expo-sqlite with wait-retry (never auto-wipe),
 * serializes transactions, and serves proxied RPC from the broker.
 */
export function createOwnerRuntime(args: {
  readonly dbName: string;
  readonly timers: Timers;
}): OwnerRuntime {
  return new OwnerRuntimeImpl(args);
}
