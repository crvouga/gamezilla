import { InMemoryPubSub } from '../../../pub-sub/impl-in-memory';
import {
  SqlClientImplSqlJs,
  type SqlJsInitConfig,
} from '../../../sql-client/impl-sql-js';
import type { SqlClient } from '../../../sql-client/interface';
import { PatchDbImplClientTransport } from '../../impl-client-transport';
import { PatchDbImplSqlite } from '../../impl-sqlite/impl-sqlite';
import { SyncPatchesDb } from '../../impl-sync';
import type { PatchesDb } from '../../interface';
import { PatchDbImplSyncHost } from '../../transport/impl-sync-host';
import { BrowserWallClockScheduler } from './sim-link-scheduler';
import { NetworkLink } from './network-link';
import { NotifyingPatchesDb } from './notifying-patches-db';
import {
  type SimServerPort,
  simServerPortFromPubSub,
  simServerPortFromSyncHost,
} from './server-port';
import { SimulatedPatchDbClientTransport } from './simulated-client-transport';
import type { SimLink } from './scenario';

const SYNC_SUBSCRIPTION_MICROTASK_ROUNDS = 32;

async function flushSyncSubscriptionMicrotasks(
  rounds: number = SYNC_SUBSCRIPTION_MICROTASK_ROUNDS
): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

function createSimLink(link: NetworkLink): SimLink {
  return {
    partition: () => link.setPartitioned(true),
    heal: () => link.setPartitioned(false),
    failNextRead: (err?: Error) =>
      link.failNextReadWith(err ?? new Error('simulated read failure')),
    failNextWrite: (err?: Error) =>
      link.failNextWriteWith(err ?? new Error('simulated write failure')),
    setLatency: (ms: number) => link.setReadWriteLatencyMs(ms),
    setInvalidationLatency: (ms: number) => link.setInvalidationLatencyMs(ms),
    isPartitioned: () => link.isPartitioned(),
  };
}

type ClientRuntime = {
  id: string;
  sqlClient: SqlClient;
  localDb: PatchDbImplSqlite;
  transport: SimulatedPatchDbClientTransport;
  syncDb: SyncPatchesDb;
  link: NetworkLink;
};

export type PlaygroundClientHandle = {
  id: string;
  syncDb: SyncPatchesDb;
  link: SimLink;
  sqlClient: SqlClient;
  localDb: PatchDbImplSqlite;
  transport: SimulatedPatchDbClientTransport;
};

export type PlaygroundSim = {
  serverId: string;
  /** Wall clock + microtasks for {@link NetworkLink}. */
  scheduler: BrowserWallClockScheduler;
  /** Authoritative server backing store (read-only debugging). */
  serverBacking: PatchDbImplSqlite;
  serverSql: SqlClient;
  serverDb: PatchesDb;
  clients: PlaygroundClientHandle[];
  /**
   * After a local write on `actorClientId`, push that client then poll every client
   * so peers converge without background timers.
   */
  syncNow(actorClientId: string): Promise<void>;
  destroy(): Promise<void>;
};

export type CreatePlaygroundSimOptions = {
  /** @default 2 */
  clientCount?: number;
  /** @default false — use {@link NotifyingPatchesDb} server. */
  useSyncHost?: boolean;
  /** @default `'srv'` */
  serverId?: string;
  /**
   * Passed to every {@link SqlClientImplSqlJs.openMemory} call (browser builds should set WASM `locateFile`, e.g. Vite `?url`).
   * The first call initializes the shared sql.js module; later calls reuse it with this same config.
   */
  sqlJs?: SqlJsInitConfig;
};

/**
 * One server + N browser-style clients: {@link SqlClientImplSqlJs}, {@link BrowserWallClockScheduler},
 * manual push/poll (no {@link SimEventRecorder}).
 */
export async function createPlaygroundSim(
  options?: CreatePlaygroundSimOptions
): Promise<PlaygroundSim> {
  const clientCount = options?.clientCount ?? 2;
  if (clientCount < 1) {
    throw new Error('createPlaygroundSim: clientCount must be >= 1');
  }
  const useSyncHost = options?.useSyncHost ?? false;
  const serverId = options?.serverId ?? 'srv';
  const sqlJs = options?.sqlJs;

  const scheduler = new BrowserWallClockScheduler();

  const serverSql = await SqlClientImplSqlJs.openMemory(sqlJs);
  await serverSql.connect();
  const serverBacking = new PatchDbImplSqlite(serverSql);
  await serverBacking.migrate();
  const serverPubSub = new InMemoryPubSub();

  let port: SimServerPort;
  if (useSyncHost) {
    const host = new PatchDbImplSyncHost(serverBacking, serverPubSub);
    port = simServerPortFromSyncHost(host);
  } else {
    const notifying = new NotifyingPatchesDb(serverBacking, serverPubSub);
    port = simServerPortFromPubSub(
      (q) => notifying.read(q),
      (p) => notifying.write(p),
      serverPubSub
    );
  }

  const clientRuntimes: ClientRuntime[] = [];

  for (let i = 0; i < clientCount; i++) {
    const id = `c${i + 1}`;
    const sqlClient = await SqlClientImplSqlJs.openMemory(sqlJs);
    await sqlClient.connect();
    const localDb = new PatchDbImplSqlite(sqlClient);
    await localDb.migrate();

    const link = new NetworkLink(scheduler);
    const transport = new SimulatedPatchDbClientTransport(port, link);
    const remotePatchesDb = new PatchDbImplClientTransport(transport);
    const clientPubSub = new InMemoryPubSub();

    const syncDb = new SyncPatchesDb(localDb, remotePatchesDb, clientPubSub, {
      pushDriver: 'manual',
      pollDriver: 'manual',
      remoteInvalidationSource: transport,
      pushIntervalMs: 10,
      logPushPollFailures: false,
    });

    clientRuntimes.push({
      id,
      sqlClient,
      localDb,
      transport,
      syncDb,
      link,
    });
  }

  const clients: PlaygroundClientHandle[] = clientRuntimes.map((c) => ({
    id: c.id,
    syncDb: c.syncDb,
    link: createSimLink(c.link),
    sqlClient: c.sqlClient,
    localDb: c.localDb,
    transport: c.transport,
  }));

  const clientById = new Map(clientRuntimes.map((c) => [c.id, c]));

  async function syncNow(actorClientId: string): Promise<void> {
    const actor = clientById.get(actorClientId);
    if (!actor) {
      throw new Error(`syncNow: unknown client ${actorClientId}`);
    }
    await actor.syncDb.runPushNow();
    for (const c of clientRuntimes) {
      await c.syncDb.runPollNow();
    }
    await flushSyncSubscriptionMicrotasks();
  }

  async function destroy(): Promise<void> {
    for (const c of clientRuntimes) {
      c.syncDb.destroy();
      await c.sqlClient.disconnect();
    }
    await serverSql.disconnect();
    clientRuntimes.length = 0;
  }

  return {
    serverId,
    scheduler,
    serverBacking,
    serverSql,
    serverDb: serverBacking,
    clients,
    syncNow,
    destroy,
  };
}

/** Run {@link SyncPatchesDb.runPollNow} on every client (e.g. after a direct {@link PlaygroundSim.serverBacking} write). */
export async function playgroundPollAllClients(sim: PlaygroundSim): Promise<void> {
  for (const c of sim.clients) {
    await c.syncDb.runPollNow();
  }
  await flushSyncSubscriptionMicrotasks();
}
