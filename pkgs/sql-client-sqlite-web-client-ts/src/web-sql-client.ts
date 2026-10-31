import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { Logger } from '@pkgs/logger-shared-ts/logger';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client-root-shared-ts/interface';
import type {
  CreateOwnerRuntimeArgs,
  TransportOwnerRuntimeFactory,
} from '@pkgs/sql-client-sqlite-web-client-ts/owner-runtime';
import { createOwnerRuntime } from '@pkgs/sql-client-sqlite-web-client-ts/owner-runtime';
import { DEFAULT_DB_HOST_SHARED_WORKER_URL } from '@pkgs/sql-client-sqlite-web-client-ts/recover-in-process';
import type { WebSqlTransport } from '@pkgs/sql-client-sqlite-web-client-ts/shared-worker-transport';
import { createSharedWorkerTransport } from '@pkgs/sql-client-sqlite-web-client-ts/shared-worker-transport';
import type { DbChangedNotify } from '@pkgs/sql-client-sqlite-web-shared-ts/rpc';
import { serializeSql } from '@pkgs/sql-client-sqlite-web-shared-ts/rpc';
import type { SqlOwner } from '@pkgs/sql-client-sqlite-web-shared-ts/sql-owner';
import type { Sql, Value } from '@pkgs/sql-root-shared-ts/sql';
import { createLeaderTransport } from './db-host-leader';

export type WebSqlClientOptions = {
  readonly timers: Timers;
  /**
   * Same-origin BroadcastChannel name on which OPFS recovery
   * (`runWebOpfsRecoveryAndReload`) asks this tab to drop its handles: on
   * `prepare-wipe` the client disconnects its owner, which terminates the
   * sqlite-wasm worker and frees every OPFS sync access handle. The host
   * keeps it the same across versions, or a tab still on an older version
   * never hears the request.
   */
  readonly wipeChannel: string;
  /** Receives open-retry warnings from the owner runtime. */
  readonly logger: Logger;
  /** Absolute URL of the SharedWorker script (default `/sql-workers/db-host-shared-worker.js`). */
  readonly sharedWorkerUrl?: string;
  /** Force leader-election path (tests / no SharedWorker). */
  readonly forceLeaderElection?: boolean;
  readonly tabId?: string;
  /** Override owner runtime factory (spec harness / tests / DST). */
  readonly createOwnerRuntime?: typeof createOwnerRuntime;
  /** Override {@link SqlOwner} factory passed into the default owner runtime. */
  readonly createOwner?: (args: { readonly dbName: string }) => SqlOwner;
  /** Post-open migrate (sync-engine). Failures wipe cache in-process. */
  readonly migrate?: (client: SqlClient) => Promise<void>;
  /** Protocol generation for SharedWorker deploy drift (optional). */
  readonly protocolVersion?: number;
};

export type WebSqlClient = SqlClient & {
  readonly dbName: string;
  isOwner: () => boolean;
  resetDatabase: () => Promise<void>;
  exportBytes: () => Promise<Uint8Array>;
  importBytes: (bytes: Uint8Array) => Promise<void>;
  onChanged: (listener: (notify: DbChangedNotify) => void) => () => void;
};

let tabSeq = 0;
function newTabId(): string {
  return `tab_${++tabSeq}`;
}

function buildOwnerRuntimeFactory(
  options: WebSqlClientOptions
): TransportOwnerRuntimeFactory {
  const base = options.createOwnerRuntime ?? createOwnerRuntime;
  return (args) => {
    const ownerArgs: CreateOwnerRuntimeArgs = {
      dbName: args.dbName,
      timers: args.timers,
      logger: options.logger,
      ...(options.createOwner !== undefined
        ? { createOwner: options.createOwner }
        : {}),
      ...(options.migrate !== undefined ? { migrate: options.migrate } : {}),
      ...(options.sharedWorkerUrl !== undefined
        ? { sharedWorkerUrl: options.sharedWorkerUrl }
        : {}),
    };
    return base(ownerArgs);
  };
}

function pickTransport(
  dbName: string,
  options: WebSqlClientOptions
): WebSqlTransport {
  const forceLeader = options.forceLeaderElection === true;
  const createOwnerRuntimeFn = buildOwnerRuntimeFactory(options);
  const hasSharedWorker = !forceLeader && typeof SharedWorker !== 'undefined';
  if (hasSharedWorker) {
    try {
      return createSharedWorkerTransport({
        dbName,
        timers: options.timers,
        workerUrl: options.sharedWorkerUrl ?? DEFAULT_DB_HOST_SHARED_WORKER_URL,
        createOwnerRuntimeFn,
        ...(options.protocolVersion !== undefined
          ? { protocolVersion: options.protocolVersion }
          : {}),
      });
    } catch (error: unknown) {
      console.warn(
        '[createWebSqlClient] SharedWorker failed; falling back to leader election',
        error
      );
    }
  }
  const leader = createLeaderTransport({
    dbName,
    timers: options.timers,
    tabId: options.tabId ?? newTabId(),
    createOwnerRuntime: createOwnerRuntimeFn,
  });
  return {
    connect: () => leader.connect(),
    disconnect: () => leader.disconnect(),
    leaveOnUnload: () => leader.leaveOnUnload(),
    request: (op, payload, opts) => leader.request(op, payload, opts),
    onChanged: (listener) => leader.onChanged(listener),
    isOwner: () => leader.isOwner(),
    getOwnerRuntime: () => leader.getOwnerRuntime(),
  };
}

type PrepareWipeMessage = {
  readonly type: 'prepare-wipe';
  readonly requestId: string;
};

function onPrepareWipeMessage(
  client: WebSqlClient,
  wipeChannel: BroadcastChannel,
  data: PrepareWipeMessage
): void {
  void client.disconnect().finally(() => {
    wipeChannel.postMessage({
      type: 'wipe-ready',
      requestId: data.requestId,
    });
  });
}

function attachWipeChannelLifecycle(
  client: WebSqlClient,
  channelName: string
): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const wipeChannel = new BroadcastChannel(channelName);
  wipeChannel.onmessage = (event: MessageEvent<PrepareWipeMessage>) => {
    const data = event.data;
    if (data === null || typeof data !== 'object') return;
    if (data.type === 'prepare-wipe') {
      onPrepareWipeMessage(client, wipeChannel, data);
    }
    // wipe-done: no navigation — initiator reopens via resetDatabase / connect.
  };
}

type PageLifecycleTarget = {
  addEventListener(
    type: 'pagehide' | 'pageshow',
    listener: (event: { readonly persisted: boolean }) => void
  ): void;
};

/**
 * On `pagehide`, leave synchronously, then disconnect. The async
 * `disconnect()` never settles in time: a discarded page is gone, and a page
 * kept in the back/forward cache is frozen still holding the OPFS handles.
 * Either way the next page in this tab would wait on a dead owner (~15s of
 * locked-handle retries, then "did not become ready"). A page restored from
 * the back/forward cache has lost its database under a live app, so it
 * reloads.
 */
export function releaseOnPageHide(
  target: PageLifecycleTarget,
  client: Pick<WebSqlClient, 'disconnect'>,
  transport: Pick<WebSqlTransport, 'leaveOnUnload'>,
  reload: () => void
): void {
  target.addEventListener('pagehide', () => {
    transport.leaveOnUnload();
    void client.disconnect();
  });
  target.addEventListener('pageshow', (event) => {
    if (event.persisted) reload();
  });
}

function attachLifecycle(
  client: WebSqlClient,
  transport: WebSqlTransport,
  wipeChannel: string
): void {
  if (typeof window !== 'undefined') {
    releaseOnPageHide(window, client, transport, () => {
      window.location.reload();
    });
    attachWipeChannelLifecycle(client, wipeChannel);
  }
}

function buildPrepared(args: {
  readonly transport: WebSqlTransport;
  readonly ensureConnected: () => Promise<void>;
  readonly query: Sql<Record<string, unknown>>;
  readonly cache: Map<
    string,
    { readonly sql: string; ready: Promise<string>; stmtId: string | null }
  >;
  readonly key: string;
}): PreparedStatement<Record<string, unknown>> {
  const { transport, ensureConnected, query, cache, key } = args;
  const ready = (async () => {
    await ensureConnected();
    const result = (await transport.request(
      'prepare',
      serializeSql(query)
    )) as {
      stmtId: string;
    };
    const entry = cache.get(key);
    if (entry !== undefined) {
      cache.set(key, { ...entry, stmtId: result.stmtId });
    }
    return result.stmtId;
  })();
  cache.set(key, { sql: query.sql, ready, stmtId: null });
  return {
    query: async (params?: Value[]) => {
      const stmtId = await ready;
      return (await transport.request('stmtQuery', {
        stmtId,
        params: params ?? [],
      })) as Record<string, unknown>[];
    },
    run: async (params?: Value[]) => {
      const stmtId = await ready;
      return (await transport.request('stmtRun', {
        stmtId,
        params: params ?? [],
      })) as RunResult;
    },
  };
}

async function runTransaction<T>(
  transport: WebSqlTransport,
  prepare: SqlClient['prepare'],
  fn: (tx: SqlClient) => Promise<T>
): Promise<T> {
  const { txId } = (await transport.request('beginTx', {})) as {
    txId: string;
  };
  const tx: SqlClient = {
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    query: async (q) =>
      (await transport.request('txQuery', {
        txId,
        sql: serializeSql(q),
      })) as never,
    run: async (q) =>
      (await transport.request('txRun', {
        txId,
        sql: serializeSql(q),
      })) as RunResult,
    prepare,
    transaction: async (innerFn) => innerFn(tx),
  };
  try {
    const result = await fn(tx);
    await transport.request('commitTx', { txId });
    return result;
  } catch (error: unknown) {
    try {
      await transport.request('rollbackTx', { txId });
    } catch {
      // preserve original
    }
    throw error;
  }
}

/**
 * Multi-tab-safe web {@link SqlClient} backed by a dedicated sqlite-wasm worker
 * (`@sqlite.org/sqlite-wasm` over the OPFS SAH pool). Exactly one tab owns the
 * store; peers proxy over SharedWorker or BroadcastChannel leader election.
 * The owning tab's worker dies on drop/tab-close, which releases every OPFS
 * sync access handle. Open failures wipe the cache in-process — never navigate.
 */
export function createWebSqlClient(
  dbName: string,
  options: WebSqlClientOptions
): WebSqlClient {
  const transport = pickTransport(dbName, options);
  let connectPromise: Promise<void> | null = null;
  let disconnected = false;
  const prepared = new Map<
    string,
    { readonly sql: string; ready: Promise<string>; stmtId: string | null }
  >();
  let prepSeq = 0;

  const ensureConnected = async () => {
    disconnected = false;
    if (connectPromise === null) {
      connectPromise = transport.connect().then(() => undefined);
    }
    await connectPromise;
  };

  const client: WebSqlClient = {
    dbName,
    isOwner: () => transport.isOwner(),
    onChanged: (listener) => transport.onChanged(listener),
    resetDatabase: async () => {
      await transport.disconnect();
      connectPromise = null;
      await ensureConnected();
      await transport.request('resetDatabase', {});
    },
    exportBytes: async () => {
      await ensureConnected();
      return (await transport.request('exportBytes', {})) as Uint8Array;
    },
    importBytes: async (bytes: Uint8Array) => {
      await ensureConnected();
      await transport.request('importBytes', { bytes });
    },
    connect: ensureConnected,
    disconnect: async () => {
      if (disconnected) return;
      disconnected = true;
      for (const [, prep] of prepared) {
        if (prep.stmtId !== null) {
          try {
            await transport.request('finalize', { stmtId: prep.stmtId });
          } catch {
            // ignore
          }
        }
      }
      prepared.clear();
      await transport.disconnect();
      connectPromise = null;
    },
    query: async <T extends Record<string, unknown>>(query: Sql<T>) => {
      await ensureConnected();
      return (await transport.request('query', serializeSql(query))) as T[];
    },
    run: async (query: Sql<unknown>) => {
      await ensureConnected();
      return (await transport.request('run', serializeSql(query))) as RunResult;
    },
    prepare: <T extends Record<string, unknown>>(query: Sql<T>) => {
      const key = `prep_${++prepSeq}`;
      return buildPrepared({
        transport,
        ensureConnected,
        query: query as Sql<Record<string, unknown>>,
        cache: prepared,
        key,
      }) as PreparedStatement<T>;
    },
    transaction: async <T>(fn: (tx: SqlClient) => Promise<T>) => {
      await ensureConnected();
      return runTransaction(transport, client.prepare, fn);
    },
  };

  attachLifecycle(client, transport, options.wipeChannel);
  return client;
}
