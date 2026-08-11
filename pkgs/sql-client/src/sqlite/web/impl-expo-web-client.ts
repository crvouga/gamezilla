import type { Timers } from '@pkgs/clock';
import type { Sql, Value } from '@pkgs/sql';
import type { PreparedStatement, RunResult, SqlClient } from '../../interface';
import { createLeaderTransport } from './db-host-leader';
import {
  buildWebOpfsWipePageUrl,
  consumeResetDbQueryParamAndRecover,
  DEFAULT_DB_HOST_SHARED_WORKER_URL,
  OPFS_WIPE_INITIATOR_SESSION_KEY,
  sanitizeWebOpfsReturnTo,
} from './opfs-recover';
import { OPFS_WIPE_CHANNEL, type OpfsWipeMessage } from './opfs-wipe-channel';
import { createOwnerRuntime } from './owner-runtime';
import type { DbChangedNotify } from './rpc';
import { serializeSql } from './rpc';
import {
  createSharedWorkerTransport,
  type WebSqlTransport,
} from './shared-worker-transport';

export type ExpoWebSqlClientOptions = {
  readonly timers: Timers;
  /** Absolute URL of the SharedWorker script (default `/sql-workers/db-host-shared-worker.js`). */
  readonly sharedWorkerUrl?: string;
  /** Force leader-election path (tests / no SharedWorker). */
  readonly forceLeaderElection?: boolean;
  readonly tabId?: string;
  /** Override owner runtime factory (e2e harness / tests). */
  readonly createOwnerRuntime?: typeof createOwnerRuntime;
};

export type ExpoWebSqlClient = SqlClient & {
  readonly dbName: string;
  isOwner: () => boolean;
  resetDatabase: () => Promise<void>;
  onChanged: (listener: (notify: DbChangedNotify) => void) => () => void;
};

let tabSeq = 0;
function newTabId(): string {
  return `tab_${++tabSeq}`;
}

function pickTransport(
  dbName: string,
  options: ExpoWebSqlClientOptions
): WebSqlTransport {
  const forceLeader = options.forceLeaderElection === true;
  const createOwnerRuntimeFn = options.createOwnerRuntime ?? createOwnerRuntime;
  const hasSharedWorker = !forceLeader && typeof SharedWorker !== 'undefined';
  if (hasSharedWorker) {
    try {
      return createSharedWorkerTransport({
        dbName,
        timers: options.timers,
        workerUrl: options.sharedWorkerUrl ?? DEFAULT_DB_HOST_SHARED_WORKER_URL,
        createOwnerRuntimeFn,
      });
    } catch (error: unknown) {
      console.warn(
        '[createExpoWebSqlClient] SharedWorker failed; falling back to leader election',
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
    request: (op, payload, opts) => leader.request(op, payload, opts),
    onChanged: (listener) => leader.onChanged(listener),
    isOwner: () => leader.isOwner(),
    getOwnerRuntime: () => leader.getOwnerRuntime(),
  };
}

function isWipeOrParkDocumentPath(path: string): boolean {
  return (
    path.includes('opfs-wiping') ||
    path.includes('opfs-wipe') ||
    path.includes('opfs-wipe-boot')
  );
}

function isOpfsWipeInitiator(): boolean {
  try {
    return sessionStorage.getItem(OPFS_WIPE_INITIATOR_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function parkPeerOnWipeDocument(): void {
  const returnTo = sanitizeWebOpfsReturnTo(
    window.location.pathname + window.location.search + window.location.hash
  );
  window.location.replace(buildWebOpfsWipePageUrl({ returnTo, parked: true }));
}

function onPrepareWipeMessage(
  client: ExpoWebSqlClient,
  wipeChannel: BroadcastChannel,
  data: Extract<OpfsWipeMessage, { type: 'prepare-wipe' }>
): void {
  // closeAsync alone does not drop Chrome AccessHandlePoolVFS handles —
  // peer tabs must unload expo-sqlite (park on the wipe document).
  // The recovery initiator skips park via sessionStorage and navigates
  // itself to the wipe executor after prepare/force-release.
  void client.disconnect().finally(() => {
    wipeChannel.postMessage({
      type: 'wipe-ready',
      requestId: data.requestId,
    } satisfies OpfsWipeMessage);
    if (isOpfsWipeInitiator()) return;
    parkPeerOnWipeDocument();
  });
}

function onWipeDoneMessage(): void {
  // Wipe / park documents navigate themselves; reloading them re-enters
  // the wipe bootstrap and loops (seen in Cursor's embedded browser).
  try {
    const path = window.location.pathname + window.location.search;
    if (isWipeOrParkDocumentPath(path)) return;
  } catch {
    // ignore
  }
  window.location.reload();
}

function attachWipeChannelLifecycle(client: ExpoWebSqlClient): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const wipeChannel = new BroadcastChannel(OPFS_WIPE_CHANNEL);
  wipeChannel.onmessage = (event: MessageEvent<OpfsWipeMessage>) => {
    const data = event.data;
    if (data === null || typeof data !== 'object') return;
    if (data.type === 'prepare-wipe') {
      onPrepareWipeMessage(client, wipeChannel, data);
      return;
    }
    if (data.type === 'wipe-done') {
      onWipeDoneMessage();
    }
  };
}

function attachLifecycle(client: ExpoWebSqlClient): void {
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
      void client.disconnect();
    });
    attachWipeChannelLifecycle(client);
  }
  // Metro HMR: use CommonJS `module.hot` — never `import.meta.hot`
  // (Hermes web classic script: "Cannot use 'import.meta' outside a module").
  const metroHot =
    typeof module !== 'undefined'
      ? (
          module as {
            hot?: { dispose: (cb: () => void) => void };
          }
        ).hot
      : undefined;
  if (metroHot !== undefined) {
    metroHot.dispose(() => {
      void client.disconnect();
    });
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
    )) as { stmtId: string };
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
 * Multi-tab-safe web {@link SqlClient} backed by expo-sqlite (wa-sqlite + OPFS).
 * Exactly one tab owns the OPFS handles; peers proxy over SharedWorker or
 * BroadcastChannel leader election.
 */
export function createExpoWebSqlClient(
  dbName: string,
  options: ExpoWebSqlClientOptions
): ExpoWebSqlClient {
  const transport = pickTransport(dbName, options);
  let connectPromise: Promise<void> | null = null;
  let disconnected = false;
  const prepared = new Map<
    string,
    { readonly sql: string; ready: Promise<string>; stmtId: string | null }
  >();
  let prepSeq = 0;
  /** After first connect, skip re-parsing `?reset-db=` on every query. */
  let resetDbChecked = false;

  const ensureConnected = async () => {
    disconnected = false;
    if (!resetDbChecked) {
      resetDbChecked = true;
      await consumeResetDbQueryParamAndRecover(
        options.timers,
        `createExpoWebSqlClient("${dbName}")`,
        () => transport.disconnect()
      );
    }
    if (connectPromise === null) {
      connectPromise = transport.connect().then(() => undefined);
    }
    await connectPromise;
  };

  const client: ExpoWebSqlClient = {
    dbName,
    isOwner: () => transport.isOwner(),
    onChanged: (listener) => transport.onChanged(listener),
    resetDatabase: async () => {
      await ensureConnected();
      await transport.request('resetDatabase', {});
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

  attachLifecycle(client);
  return client;
}
