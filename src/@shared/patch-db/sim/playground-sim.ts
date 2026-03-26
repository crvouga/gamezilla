import { InMemoryPubSub } from '../../pub-sub/impl-in-memory';
import {
  SqlClientImplSqlJs,
  type SqlJsInitConfig,
} from '../../sql-client/impl-sql-js';
import type { SqlClient } from '../../sql-client/interface';
import { PatchDbImplClientTransport } from '../impl-client-transport';
import { PatchDbImplSqlite } from '../impl-sqlite/impl-sqlite';
import { SyncPatchesDb } from '../impl-sync';
import type { PatchesDb } from '../interface';
import { PatchDbImplSyncHost } from '../transport/impl-sync-host';
import { NetworkLink } from './network-link';
import { NotifyingPatchesDb } from './notifying-patches-db';
import type { SimLink } from './scenario';
import {
  type SimServerPort,
  simServerPortFromPubSub,
  simServerPortFromSyncHost,
} from './server-port';
import { BrowserWallClockScheduler } from './sim-link-scheduler';
import { SimulatedPatchDbClientTransport } from './simulated-client-transport';

const MARK_ALL_UNSYNCED = `UPDATE patches SET attributes = json_remove(attributes, '$."patch/syncedAt"')`;

// ─── Snapshot types ───────────────────────────────────────────────────

export type PlaygroundSimSnapshot = {
  serverId: string;
  serverDb: Uint8Array;
  serverPartitioned?: boolean;
  clients: PlaygroundClientSnapshot[];
};

export type PlaygroundClientSnapshot = {
  id: string;
  db: Uint8Array;
  latencyMs: number;
  partitioned: boolean;
};

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
    getLatency: () => link.getReadWriteLatencyMs(),
    setInvalidationLatency: (ms: number) => link.setInvalidationLatencyMs(ms),
    isPartitioned: () => link.isPartitioned(),
  };
}

class PartitionableServerPort {
  private partitioned = false;

  constructor(private readonly inner: SimServerPort) {}

  setPartitioned(value: boolean): void {
    this.partitioned = value;
  }

  isPartitioned(): boolean {
    return this.partitioned;
  }

  read(queries: Parameters<SimServerPort['read']>[0]) {
    if (this.partitioned) {
      return Promise.reject(new Error('server is partitioned'));
    }
    return this.inner.read(queries);
  }

  write(patches: Parameters<SimServerPort['write']>[0]) {
    if (this.partitioned) {
      return Promise.reject(new Error('server is partitioned'));
    }
    return this.inner.write(patches);
  }

  subscribeInvalidations(callback: () => void) {
    return this.inner.subscribeInvalidations(() => {
      if (!this.partitioned) callback();
    });
  }
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
  scheduler: BrowserWallClockScheduler;
  serverBacking: PatchDbImplSqlite;
  serverSql: SqlClient;
  serverDb: PatchesDb;
  clients: PlaygroundClientHandle[];
  syncNow(actorClientId: string): Promise<void>;
  addClient(): Promise<PlaygroundClientHandle>;
  removeClient(id: string): Promise<void>;
  destroy(): Promise<void>;
  takeSnapshot(): PlaygroundSimSnapshot;
  pollAllClients(): Promise<void>;
  wipeServerDb(): Promise<void>;
  wipeClientDb(clientId: string): Promise<void>;
  isServerPartitioned(): boolean;
  partitionServer(): void;
  healServer(): void;
};

export type CreatePlaygroundSimOptions = {
  /** @default 2 */
  clientCount?: number;
  /** @default false */
  useSyncHost?: boolean;
  /** @default `'srv'` */
  serverId?: string;
  sqlJs?: SqlJsInitConfig;
};

export async function createPlaygroundSim(
  options?: CreatePlaygroundSimOptions
): Promise<PlaygroundSim> {
  const clientCount = options?.clientCount ?? 2;
  const useSyncHost = options?.useSyncHost ?? false;
  const serverId = options?.serverId ?? 'srv';
  const sqlJs = options?.sqlJs;

  const scheduler = new BrowserWallClockScheduler();

  const serverSql = await SqlClientImplSqlJs.openMemory(sqlJs);
  await serverSql.connect();
  const serverBacking = new PatchDbImplSqlite(serverSql);
  await serverBacking.migrate();
  const serverPubSub = new InMemoryPubSub();

  let innerPort: SimServerPort;
  if (useSyncHost) {
    const host = new PatchDbImplSyncHost(serverBacking, serverPubSub);
    innerPort = simServerPortFromSyncHost(host);
  } else {
    const notifying = new NotifyingPatchesDb(serverBacking, serverPubSub);
    innerPort = simServerPortFromPubSub(
      (q) => notifying.read(q),
      (p) => notifying.write(p),
      serverPubSub
    );
  }
  const port = new PartitionableServerPort(innerPort);

  const clientRuntimes: ClientRuntime[] = [];
  const clients: PlaygroundClientHandle[] = [];
  const clientById = new Map<string, ClientRuntime>();
  let nextClientNum = 1;

  async function createClientRuntime(
    id: string
  ): Promise<{ runtime: ClientRuntime; handle: PlaygroundClientHandle }> {
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

    const runtime: ClientRuntime = {
      id,
      sqlClient,
      localDb,
      transport,
      syncDb,
      link,
    };
    const handle: PlaygroundClientHandle = {
      id,
      syncDb,
      link: createSimLink(link),
      sqlClient,
      localDb,
      transport,
    };
    return { runtime, handle };
  }

  for (let i = 0; i < clientCount; i++) {
    const id = `c${nextClientNum++}`;
    const { runtime, handle } = await createClientRuntime(id);
    clientRuntimes.push(runtime);
    clients.push(handle);
    clientById.set(id, runtime);
  }

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

  async function addClient(): Promise<PlaygroundClientHandle> {
    const id = `c${nextClientNum++}`;
    const { runtime, handle } = await createClientRuntime(id);
    clientRuntimes.push(runtime);
    clients.push(handle);
    clientById.set(id, runtime);
    await runtime.syncDb.runPollNow();
    await flushSyncSubscriptionMicrotasks();
    return handle;
  }

  async function removeClient(id: string): Promise<void> {
    const runtime = clientById.get(id);
    if (!runtime) throw new Error(`removeClient: unknown client ${id}`);
    runtime.syncDb.destroy();
    await runtime.sqlClient.disconnect();
    clientById.delete(id);
    const ri = clientRuntimes.indexOf(runtime);
    if (ri >= 0) clientRuntimes.splice(ri, 1);
    const ci = clients.findIndex((c) => c.id === id);
    if (ci >= 0) clients.splice(ci, 1);
  }

  async function destroy(): Promise<void> {
    for (const c of clientRuntimes) {
      c.syncDb.destroy();
      await c.sqlClient.disconnect();
    }
    await serverSql.disconnect();
    clientRuntimes.length = 0;
  }

  function takeSnapshot(): PlaygroundSimSnapshot {
    const serverSqlJs = serverSql as SqlClientImplSqlJs;
    return {
      serverId,
      serverDb: serverSqlJs.exportData(),
      serverPartitioned: port.isPartitioned(),
      clients: clients.map((c) => {
        const clientSqlJs = c.sqlClient as SqlClientImplSqlJs;
        return {
          id: c.id,
          db: clientSqlJs.exportData(),
          latencyMs: c.link.getLatency(),
          partitioned: c.link.isPartitioned(),
        };
      }),
    };
  }

  async function pollAllClients(): Promise<void> {
    for (const c of clientRuntimes) {
      await c.syncDb.runPollNow();
    }
    await flushSyncSubscriptionMicrotasks();
  }

  async function wipeServerDb(): Promise<void> {
    await serverSql.run('DELETE FROM patches');
    await serverSql.run('DELETE FROM snapshots');
    for (const c of clientRuntimes) {
      await c.sqlClient.run(MARK_ALL_UNSYNCED);
      c.syncDb.notifyInvalidated();
    }
  }

  async function wipeClientDb(clientId: string): Promise<void> {
    const c = clientRuntimes.find((r) => r.id === clientId);
    if (!c) return;
    await c.sqlClient.run('DELETE FROM patches');
    await c.sqlClient.run('DELETE FROM snapshots');
    c.syncDb.notifyInvalidated();
  }

  return {
    serverId,
    scheduler,
    serverBacking,
    serverSql,
    serverDb: serverBacking,
    clients,
    syncNow,
    addClient,
    removeClient,
    destroy,
    takeSnapshot,
    pollAllClients,
    wipeServerDb,
    wipeClientDb,
    isServerPartitioned: () => port.isPartitioned(),
    partitionServer: () => port.setPartitioned(true),
    healServer: () => port.setPartitioned(false),
  };
}

/**
 * Restore a sim from a previously taken snapshot.
 * All SQLite databases are recreated from exported binary data.
 */
export async function restorePlaygroundSim(
  snapshot: PlaygroundSimSnapshot,
  options?: { sqlJs?: SqlJsInitConfig }
): Promise<PlaygroundSim> {
  const sqlJs = options?.sqlJs;
  const scheduler = new BrowserWallClockScheduler();

  const serverSql = await SqlClientImplSqlJs.openFromData(
    snapshot.serverDb,
    sqlJs
  );
  await serverSql.connect();
  const serverBacking = new PatchDbImplSqlite(serverSql);
  const serverPubSub = new InMemoryPubSub();
  const notifying = new NotifyingPatchesDb(serverBacking, serverPubSub);
  const innerPort: SimServerPort = simServerPortFromPubSub(
    (q) => notifying.read(q),
    (p) => notifying.write(p),
    serverPubSub
  );
  const port = new PartitionableServerPort(innerPort);
  if (snapshot.serverPartitioned) port.setPartitioned(true);

  const clientRuntimes: ClientRuntime[] = [];
  const clients: PlaygroundClientHandle[] = [];
  const clientById = new Map<string, ClientRuntime>();
  let nextClientNum =
    snapshot.clients.reduce((max, c) => {
      const n = parseInt(c.id.replace(/\D/g, ''), 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0) + 1;

  for (const cs of snapshot.clients) {
    const sqlClient = await SqlClientImplSqlJs.openFromData(cs.db, sqlJs);
    await sqlClient.connect();
    const localDb = new PatchDbImplSqlite(sqlClient);

    const link = new NetworkLink(scheduler);
    if (cs.latencyMs > 0) link.setReadWriteLatencyMs(cs.latencyMs);
    if (cs.partitioned) link.setPartitioned(true);

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

    const runtime: ClientRuntime = {
      id: cs.id,
      sqlClient,
      localDb,
      transport,
      syncDb,
      link,
    };
    const handle: PlaygroundClientHandle = {
      id: cs.id,
      syncDb,
      link: createSimLink(link),
      sqlClient,
      localDb,
      transport,
    };
    clientRuntimes.push(runtime);
    clients.push(handle);
    clientById.set(cs.id, runtime);
  }

  async function createClientRuntime(
    id: string
  ): Promise<{ runtime: ClientRuntime; handle: PlaygroundClientHandle }> {
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

    const runtime: ClientRuntime = {
      id,
      sqlClient,
      localDb,
      transport,
      syncDb,
      link,
    };
    const handle: PlaygroundClientHandle = {
      id,
      syncDb,
      link: createSimLink(link),
      sqlClient,
      localDb,
      transport,
    };
    return { runtime, handle };
  }

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

  async function addClient(): Promise<PlaygroundClientHandle> {
    const id = `c${nextClientNum++}`;
    const { runtime, handle } = await createClientRuntime(id);
    clientRuntimes.push(runtime);
    clients.push(handle);
    clientById.set(id, runtime);
    await runtime.syncDb.runPollNow();
    await flushSyncSubscriptionMicrotasks();
    return handle;
  }

  async function removeClient(id: string): Promise<void> {
    const runtime = clientById.get(id);
    if (!runtime) throw new Error(`removeClient: unknown client ${id}`);
    runtime.syncDb.destroy();
    await runtime.sqlClient.disconnect();
    clientById.delete(id);
    const ri = clientRuntimes.indexOf(runtime);
    if (ri >= 0) clientRuntimes.splice(ri, 1);
    const ci = clients.findIndex((c) => c.id === id);
    if (ci >= 0) clients.splice(ci, 1);
  }

  async function destroy(): Promise<void> {
    for (const c of clientRuntimes) {
      c.syncDb.destroy();
      await c.sqlClient.disconnect();
    }
    await serverSql.disconnect();
    clientRuntimes.length = 0;
  }

  function takeSnapshot(): PlaygroundSimSnapshot {
    return {
      serverId: snapshot.serverId,
      serverDb: serverSql.exportData(),
      serverPartitioned: port.isPartitioned(),
      clients: clients.map((c) => {
        const clientSqlJs = c.sqlClient as SqlClientImplSqlJs;
        return {
          id: c.id,
          db: clientSqlJs.exportData(),
          latencyMs: c.link.getLatency(),
          partitioned: c.link.isPartitioned(),
        };
      }),
    };
  }

  async function pollAllClients(): Promise<void> {
    for (const c of clientRuntimes) {
      await c.syncDb.runPollNow();
    }
    await flushSyncSubscriptionMicrotasks();
  }

  async function wipeServerDb(): Promise<void> {
    await serverSql.run('DELETE FROM patches');
    await serverSql.run('DELETE FROM snapshots');
    for (const c of clientRuntimes) {
      await c.sqlClient.run(MARK_ALL_UNSYNCED);
      c.syncDb.notifyInvalidated();
    }
  }

  async function wipeClientDb(clientId: string): Promise<void> {
    const c = clientRuntimes.find((r) => r.id === clientId);
    if (!c) return;
    await c.sqlClient.run('DELETE FROM patches');
    await c.sqlClient.run('DELETE FROM snapshots');
    c.syncDb.notifyInvalidated();
  }

  return {
    serverId: snapshot.serverId,
    scheduler,
    serverBacking,
    serverSql,
    serverDb: serverBacking,
    clients,
    syncNow,
    addClient,
    removeClient,
    destroy,
    takeSnapshot,
    pollAllClients,
    wipeServerDb,
    wipeClientDb,
    isServerPartitioned: () => port.isPartitioned(),
    partitionServer: () => port.setPartitioned(true),
    healServer: () => port.setPartitioned(false),
  };
}

/** Run {@link SyncPatchesDb.runPollNow} on every client (e.g. after a direct {@link PlaygroundSim.serverBacking} write). */
export async function playgroundPollAllClients(
  sim: PlaygroundSim
): Promise<void> {
  for (const c of sim.clients) {
    await c.syncDb.runPollNow();
  }
  await flushSyncSubscriptionMicrotasks();
}
