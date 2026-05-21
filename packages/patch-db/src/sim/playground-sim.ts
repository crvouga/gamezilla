import { InMemoryPubSub } from '@gamezilla/pub-sub/impl-in-memory';
import type { SqlClient } from '@gamezilla/sql-client/interface';
import { PatchDbImplClientTransport } from '../impl-client-transport';
import { PatchDbImplSqlite } from '../impl-sqlite/impl-sqlite';
import { SyncPatchDb } from '../impl-sync';
import type { PatchDb } from '../interface';
import { NetworkLink } from './network-link';
import { NotifyingPatchDb } from './notifying-patch-db';
import type { SimLink } from './scenario';
import { type SimServerPort, simServerPortFromPubSub } from './server-port';
import { BrowserWallClockScheduler } from './sim-link-scheduler';
import { SimulatedPatchDbClientTransport } from './simulated-client-transport';

export type PlaygroundDbFactory = {
  /** Create a fresh, empty database for the given playground node. */
  create(label: string): Promise<SqlClient>;
  /** Reopen a previously created database (for session restore). */
  reopen(label: string): Promise<SqlClient>;
  /** Called when a playground node's database is being permanently removed. */
  remove(label: string): Promise<void>;
  /** Remove all playground databases (full reset). */
  removeAll(labels: string[]): Promise<void>;
};

export type PlaygroundSimSnapshot = {
  serverId: string;
  serverPartitioned?: boolean;
  clients: PlaygroundClientSnapshot[];
};

export type PlaygroundClientSnapshot = {
  id: string;
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

  read(
    queries: Parameters<SimServerPort['read']>[0],
    ctx?: Parameters<SimServerPort['read']>[1]
  ) {
    if (this.partitioned) {
      return Promise.reject(new Error('server is partitioned'));
    }
    return this.inner.read(queries, ctx);
  }

  write(
    patches: Parameters<SimServerPort['write']>[0],
    ctx?: Parameters<SimServerPort['write']>[1]
  ) {
    if (this.partitioned) {
      return Promise.reject(new Error('server is partitioned'));
    }
    return this.inner.write(patches, ctx);
  }
}

type ClientRuntime = {
  id: string;
  sqlClient: SqlClient;
  localDb: PatchDbImplSqlite;
  transport: SimulatedPatchDbClientTransport;
  syncDb: SyncPatchDb;
  link: NetworkLink;
};

export type PlaygroundClientHandle = {
  id: string;
  syncDb: SyncPatchDb;
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
  serverDb: PatchDb;
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
  /** Set baseline latency on all current and future client links. */
  setGlobalLatency(ms: number): void;
  getGlobalLatency(): number;
};

export type CreatePlaygroundSimOptions = {
  /** Required factory for creating/restoring SqlClient instances. */
  dbFactory: PlaygroundDbFactory;
  /** @default 2 */
  clientCount?: number;
  /** @default `'srv'` */
  serverId?: string;
};

type SimState = {
  globalLatencyMs: number;
  nextClientNum: number;
};

type SimContext = {
  scheduler: BrowserWallClockScheduler;
  port: PartitionableServerPort;
  serverSql: SqlClient;
  serverBacking: PatchDbImplSqlite;
  serverId: string;
  dbFactory: PlaygroundDbFactory;
  clientRuntimes: ClientRuntime[];
  clients: PlaygroundClientHandle[];
  clientById: Map<string, ClientRuntime>;
  state: SimState;
};

type ClientRuntimeAndHandle = {
  runtime: ClientRuntime;
  handle: PlaygroundClientHandle;
};

async function buildServerStack(
  serverId: string,
  serverSql: SqlClient
): Promise<{
  serverBacking: PatchDbImplSqlite;
  port: PartitionableServerPort;
}> {
  const serverBacking = new PatchDbImplSqlite(serverSql);
  const serverPubSub = new InMemoryPubSub();
  const notifying = new NotifyingPatchDb(serverBacking, serverPubSub);
  const innerPort: SimServerPort = simServerPortFromPubSub(
    (q, ctx) => notifying.read(q, ctx),
    (p, ctx) => notifying.write(p, ctx),
    serverPubSub
  );
  void serverId;
  return {
    serverBacking,
    port: new PartitionableServerPort(innerPort),
  };
}

function buildClientFromSql(
  ctx: SimContext,
  id: string,
  sqlClient: SqlClient
): ClientRuntimeAndHandle {
  const localDb = new PatchDbImplSqlite(sqlClient);
  const link = new NetworkLink(ctx.scheduler);
  if (ctx.state.globalLatencyMs > 0) {
    link.setReadWriteLatencyMs(ctx.state.globalLatencyMs);
  }
  const transport = new SimulatedPatchDbClientTransport(ctx.port, link);
  const remotePatchDb = new PatchDbImplClientTransport(transport);
  const clientPubSub = new InMemoryPubSub();
  const syncDb = new SyncPatchDb(localDb, remotePatchDb, clientPubSub, {
    pushDriver: 'manual',
    pollDriver: 'manual',
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

async function createClientRuntime(
  ctx: SimContext,
  id: string
): Promise<ClientRuntimeAndHandle> {
  const sqlClient = await ctx.dbFactory.create(`playground_${id}`);
  await sqlClient.connect();
  const result = buildClientFromSql(ctx, id, sqlClient);
  await result.runtime.localDb.migrate();
  return result;
}

function registerClient(
  ctx: SimContext,
  runtime: ClientRuntime,
  handle: PlaygroundClientHandle
): void {
  ctx.clientRuntimes.push(runtime);
  ctx.clients.push(handle);
  ctx.clientById.set(runtime.id, runtime);
}

async function ctxSyncNow(
  ctx: SimContext,
  actorClientId: string
): Promise<void> {
  const actor = ctx.clientById.get(actorClientId);
  if (!actor) {
    throw new Error(`syncNow: unknown client ${actorClientId}`);
  }
  await actor.syncDb.runPushNow();
  for (const c of ctx.clientRuntimes) {
    await c.syncDb.runPollNow();
  }
  await flushSyncSubscriptionMicrotasks();
}

async function ctxAddClient(ctx: SimContext): Promise<PlaygroundClientHandle> {
  const id = `c${ctx.state.nextClientNum++}`;
  const { runtime, handle } = await createClientRuntime(ctx, id);
  registerClient(ctx, runtime, handle);
  await runtime.syncDb.runPollNow();
  await flushSyncSubscriptionMicrotasks();
  return handle;
}

async function ctxRemoveClient(ctx: SimContext, id: string): Promise<void> {
  const runtime = ctx.clientById.get(id);
  if (!runtime) throw new Error(`removeClient: unknown client ${id}`);
  runtime.syncDb.destroy();
  await runtime.sqlClient.disconnect();
  await ctx.dbFactory.remove(`playground_${id}`);
  ctx.clientById.delete(id);
  const ri = ctx.clientRuntimes.indexOf(runtime);
  if (ri >= 0) ctx.clientRuntimes.splice(ri, 1);
  const ci = ctx.clients.findIndex((c) => c.id === id);
  if (ci >= 0) ctx.clients.splice(ci, 1);
}

async function ctxDestroy(ctx: SimContext): Promise<void> {
  for (const c of ctx.clientRuntimes) {
    c.syncDb.destroy();
    await c.sqlClient.disconnect();
  }
  await ctx.serverSql.disconnect();
  ctx.clientRuntimes.length = 0;
}

function ctxTakeSnapshot(ctx: SimContext): PlaygroundSimSnapshot {
  return {
    serverId: ctx.serverId,
    serverPartitioned: ctx.port.isPartitioned(),
    clients: ctx.clients.map((c) => ({
      id: c.id,
      latencyMs: c.link.getLatency(),
      partitioned: c.link.isPartitioned(),
    })),
  };
}

async function ctxPollAllClients(ctx: SimContext): Promise<void> {
  for (const c of ctx.clientRuntimes) {
    await c.syncDb.runPollNow();
  }
  await flushSyncSubscriptionMicrotasks();
}

async function ctxWipeServerDb(ctx: SimContext): Promise<void> {
  await ctx.serverSql.run('DELETE FROM patches');
  await ctx.serverSql.run('DELETE FROM snapshots');
  for (const c of ctx.clientRuntimes) {
    c.syncDb.notifyInvalidated();
  }
}

async function ctxWipeClientDb(
  ctx: SimContext,
  clientId: string
): Promise<void> {
  const c = ctx.clientRuntimes.find((r) => r.id === clientId);
  if (!c) return;
  await c.sqlClient.run('DELETE FROM patches');
  await c.sqlClient.run('DELETE FROM snapshots');
  c.syncDb.notifyInvalidated();
}

function buildSimApi(ctx: SimContext): PlaygroundSim {
  return {
    serverId: ctx.serverId,
    scheduler: ctx.scheduler,
    serverBacking: ctx.serverBacking,
    serverSql: ctx.serverSql,
    serverDb: ctx.serverBacking,
    clients: ctx.clients,
    syncNow: (actorClientId) => ctxSyncNow(ctx, actorClientId),
    addClient: () => ctxAddClient(ctx),
    removeClient: (id) => ctxRemoveClient(ctx, id),
    destroy: () => ctxDestroy(ctx),
    takeSnapshot: () => ctxTakeSnapshot(ctx),
    pollAllClients: () => ctxPollAllClients(ctx),
    wipeServerDb: () => ctxWipeServerDb(ctx),
    wipeClientDb: (clientId) => ctxWipeClientDb(ctx, clientId),
    isServerPartitioned: () => ctx.port.isPartitioned(),
    partitionServer: () => ctx.port.setPartitioned(true),
    healServer: () => ctx.port.setPartitioned(false),
    setGlobalLatency(ms: number) {
      ctx.state.globalLatencyMs = ms;
      for (const c of ctx.clientRuntimes) {
        c.link.setReadWriteLatencyMs(ms);
      }
    },
    getGlobalLatency: () => ctx.state.globalLatencyMs,
  };
}

async function buildContext(
  options: CreatePlaygroundSimOptions | { dbFactory: PlaygroundDbFactory },
  serverId: string,
  reopen: boolean
): Promise<SimContext> {
  const dbFactory = options.dbFactory;
  const scheduler = new BrowserWallClockScheduler();
  const serverSql = await (reopen
    ? dbFactory.reopen(`playground_${serverId}`)
    : dbFactory.create(`playground_${serverId}`));
  await serverSql.connect();
  const { serverBacking, port } = await buildServerStack(serverId, serverSql);
  return {
    scheduler,
    port,
    serverSql,
    serverBacking,
    serverId,
    dbFactory,
    clientRuntimes: [],
    clients: [],
    clientById: new Map(),
    state: { globalLatencyMs: 0, nextClientNum: 1 },
  };
}

export async function createPlaygroundSim(
  options: CreatePlaygroundSimOptions
): Promise<PlaygroundSim> {
  const clientCount = options.clientCount ?? 2;
  const serverId = options.serverId ?? 'srv';
  const ctx = await buildContext(options, serverId, false);
  await ctx.serverBacking.migrate();
  for (let i = 0; i < clientCount; i++) {
    const id = `c${ctx.state.nextClientNum++}`;
    const { runtime, handle } = await createClientRuntime(ctx, id);
    registerClient(ctx, runtime, handle);
  }
  return buildSimApi(ctx);
}

async function restoreClient(
  ctx: SimContext,
  cs: PlaygroundClientSnapshot
): Promise<void> {
  const sqlClient = await ctx.dbFactory.reopen(`playground_${cs.id}`);
  await sqlClient.connect();
  const { runtime, handle } = buildClientFromSql(ctx, cs.id, sqlClient);
  if (cs.latencyMs > 0) runtime.link.setReadWriteLatencyMs(cs.latencyMs);
  if (cs.partitioned) runtime.link.setPartitioned(true);
  registerClient(ctx, runtime, handle);
}

function computeNextClientNum(snapshot: PlaygroundSimSnapshot): number {
  const max = snapshot.clients.reduce((acc, c) => {
    const n = parseInt(c.id.replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return max + 1;
}

/**
 * Restore a sim from a previously taken snapshot.
 * Databases are reopened via the factory (file-backed DBs already contain their data).
 */
export async function restorePlaygroundSim(
  snapshot: PlaygroundSimSnapshot,
  options: { dbFactory: PlaygroundDbFactory }
): Promise<PlaygroundSim> {
  const ctx = await buildContext(options, snapshot.serverId, true);
  if (snapshot.serverPartitioned) ctx.port.setPartitioned(true);
  ctx.state.nextClientNum = computeNextClientNum(snapshot);
  for (const cs of snapshot.clients) {
    await restoreClient(ctx, cs);
  }
  return buildSimApi(ctx);
}

/** Run {@link SyncPatchDb.runPollNow} on every client (e.g. after a direct {@link PlaygroundSim.serverBacking} write). */
export async function playgroundPollAllClients(
  sim: PlaygroundSim
): Promise<void> {
  for (const c of sim.clients) {
    await c.syncDb.runPollNow();
  }
  await flushSyncSubscriptionMicrotasks();
}
