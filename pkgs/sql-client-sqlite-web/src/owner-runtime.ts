import type { Timers } from '@pkgs/clock';
import type { PreparedStatement, SqlClient } from '@pkgs/sql-client/interface';
import { applySqliteConnectionPragmas } from '@pkgs/sql-client-sqlite/connection-pragmas';
import {
  isLikelyOpfsLockError,
  openWithWaitRetry,
} from '@pkgs/sql-client-sqlite/expo-sqlite-core';
import {
  type ActiveTx,
  handleOwnerRequest,
  type OwnerHandlerDeps,
} from './owner-handlers';
import { createExpoIframeSqlOwner } from './owners/expo-iframe-sql-owner';
import {
  openSqlOwnerWithRecovery,
  recoverSqlOwnerInProcess,
} from './recover-in-process';
import {
  createRpcIdFactory,
  type DbChangedNotify,
  RPC_ERROR_TX_ABORTED,
  RPC_ERROR_TX_TIMEOUT,
  type RpcRequest,
  type RpcResponse,
  TX_IDLE_TIMEOUT_MS,
} from './rpc';
import type { SqlOwner } from './sql-owner';
import { isSqlOwnerWipeWorthyError } from './sql-owner';
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

export type CreateOwnerRuntimeArgs = {
  readonly dbName: string;
  readonly timers: Timers;
  /** Override backing owner (tests / DST). Default: expo iframe. */
  readonly createOwner?: (args: { readonly dbName: string }) => SqlOwner;
  /** Post-open migrate (sync-engine). Wipe-worthy failures recover in-process. */
  readonly migrate?: (client: SqlClient) => Promise<void>;
  readonly sharedWorkerUrl?: string;
  readonly notifyPeersOnRecover?: boolean;
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

function createBypassClient(owner: SqlClient): SqlClient {
  return owner;
}

class OwnerRuntimeImpl implements OwnerRuntime {
  readonly dbName: string;
  private readonly timers: Timers;
  private readonly owner: SqlOwner;
  private readonly migrate: ((client: SqlClient) => Promise<void>) | undefined;
  private readonly sharedWorkerUrl: string | undefined;
  private readonly notifyPeersOnRecover: boolean;
  private client: SqlClient | null = null;
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

  constructor(args: CreateOwnerRuntimeArgs) {
    this.dbName = args.dbName;
    this.timers = args.timers;
    this.migrate = args.migrate;
    this.sharedWorkerUrl = args.sharedWorkerUrl;
    this.notifyPeersOnRecover = args.notifyPeersOnRecover !== false;
    const factory = args.createOwner ?? createExpoIframeSqlOwner;
    this.owner = factory({ dbName: args.dbName });
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

  private recoverOpts() {
    return {
      timers: this.timers,
      closeLocal: () => this.owner.close(),
      resetStore: () => this.owner.resetStore(),
      notifyPeers: this.notifyPeersOnRecover,
      ...(this.sharedWorkerUrl !== undefined
        ? { sharedWorkerUrl: this.sharedWorkerUrl }
        : {}),
    };
  }

  private async openOnce(): Promise<SqlClient> {
    const client = await this.owner.open();
    if (this.migrate !== undefined) {
      await this.migrate(client);
    }
    await applySqliteConnectionPragmas(client);
    return client;
  }

  private async openOwnerClient(): Promise<SqlClient> {
    try {
      return await openWithWaitRetry({
        databaseName: this.dbName,
        timers: this.timers,
        openOnce: () => this.openOnce(),
      });
    } catch (error: unknown) {
      if (!isSqlOwnerWipeWorthyError(error) && !isLikelyOpfsLockError(error)) {
        throw error;
      }
      // Lock exhausted or pool/corrupt: wipe in-process (no navigation) and reopen.
      await recoverSqlOwnerInProcess(this.recoverOpts());
      return openSqlOwnerWithRecovery({
        owner: this.owner,
        timers: this.timers,
        notifyPeers: false,
        ...(this.sharedWorkerUrl !== undefined
          ? { sharedWorkerUrl: this.sharedWorkerUrl }
          : {}),
        ...(this.migrate !== undefined
          ? {
              migrate: async (c) => {
                await this.migrate?.(c);
                await applySqliteConnectionPragmas(c);
              },
            }
          : {
              migrate: async (c) => {
                await applySqliteConnectionPragmas(c);
              },
            }),
      });
    }
  }

  private async ensureOpen(): Promise<SqlClient> {
    if (this.client !== null) return this.client;
    if (this.openPromise === null) {
      this.openPromise = (async () => {
        try {
          this.client = await this.openOwnerClient();
        } catch (error: unknown) {
          this.openPromise = null;
          throw error;
        }
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
      createBypassClient,
      resetDatabase: () => this.resetDatabase(),
      exportBytes: () => this.exportBytes(),
      importBytes: (bytes) => this.importBytes(bytes),
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
    this.client = null;
    this.openPromise = null;
    await this.owner.close();
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
    this.client = null;
    this.openPromise = null;
    await recoverSqlOwnerInProcess(this.recoverOpts());
  }

  async exportBytes(): Promise<Uint8Array> {
    const client = await this.ensureOpen();
    const withExport = client as SqlClient & {
      exportDatabaseBytes?: () => Uint8Array;
      getSqliteDatabase?: () => {
        serializeAsync: (name?: string) => Promise<Uint8Array>;
      };
    };
    if (typeof withExport.exportDatabaseBytes === 'function') {
      return withExport.exportDatabaseBytes();
    }
    if (typeof withExport.getSqliteDatabase === 'function') {
      return withExport.getSqliteDatabase().serializeAsync('main');
    }
    throw new Error('exportBytes is not supported by this SqlOwner');
  }

  async importBytes(bytes: Uint8Array): Promise<void> {
    if (this.activeTx !== null) {
      await this.abortActiveTx(
        txError(RPC_ERROR_TX_ABORTED, 'Transaction aborted by importBytes')
      );
    }
    await this.resetDatabase();
    const client = await this.ensureOpen();
    const withImport = client as SqlClient & {
      importDatabaseBytes?: (b: Uint8Array) => void;
    };
    if (typeof withImport.importDatabaseBytes === 'function') {
      withImport.importDatabaseBytes(bytes);
      return;
    }
    throw new Error('importBytes is not supported by this SqlOwner');
  }

  hasActiveTx(): boolean {
    return this.activeTx !== null;
  }
}

/**
 * Owner-tab runtime: opens via {@link SqlOwner} with in-process wipe recovery
 * (never navigates / reloads). Serializes transactions and serves broker RPC.
 */
export function createOwnerRuntime(args: CreateOwnerRuntimeArgs): OwnerRuntime {
  return new OwnerRuntimeImpl(args);
}
