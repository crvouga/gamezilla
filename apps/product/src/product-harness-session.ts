/**
 * Session façade over createHarness + room node + snapshot store.
 */

import { captureCheckpoint, restoreCheckpoint } from './product-harness-checkpoint';
import { createProductHarnessChessCommands } from './product-harness-chess-seed';
import { buildSnapshotLoadCommands } from './product-harness-fault-commands';
import { loggingFetch } from './product-harness-logging-fetch';
import { makeProductHarnessPubSubNode } from './product-harness-session-nodes';
import { addProductHarnessServer, bindLoadBalancerRouteLogs, makeProductHarnessLoadBalancerNode, refreshProductHarnessServers, removeProductHarnessServer } from './product-harness-session-servers';
import { snapshotSessionMethods } from './product-harness-session-snapshot-api';
import { detachClientsForSnapshotLoad, disposeSession, fireDomainWake, notify, refreshRoomMap, removeClient, runQuiet, wipeSession } from './product-harness-session-teardown';
import type { SessionMaps } from './product-harness-session-teardown';
import { deleteProductHarnessSnapshot, listProductHarnessSnapshots, loadProductHarnessSnapshot, PRODUCT_HARNESS_STICKY_SNAPSHOT_ID } from './product-harness-snapshots';
import type { SnapshotSessionCtx } from './product-harness-snapshots';
import { installProductHarnessStickyAutosave } from './product-harness-sticky-autosave';
import type { Client } from '@libs/app-client/create-client';
import { readEmbeddedHref } from '@libs/app-shared/embedded-href';
import { harnessActorApp } from '@libs/harness/solid-actor-root';
import type { HarnessBrowser } from '@libs/harness/browser';
import { clearProductHarnessClientDurable } from '@libs/harness/client-durable';
import type { Harness } from '@libs/harness/create-harness';
import {
  nextHarnessNodeId,
  normalizeHarnessNodeId,
} from '@libs/harness/node-name';
import { createProductHarnessLogBuffer } from '@pkgs/harness-console-shared/product-harness-log-buffer';
import type { ProductHarnessActor, ProductHarnessLoadBalancerNode, ProductHarnessMemoryHistory, ProductHarnessPaletteCommand, ProductHarnessSession } from '@pkgs/harness-console-shared/ports';
import { createLogger } from '@pkgs/logger-shared/logger';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import { createInMemoryPublishOnlyPubSub } from '@pkgs/pubsub-shared/in-memory';
import type { Topic } from '@pkgs/pubsub-shared/topic';
import { notifyChannels } from '@pkgs/sync-engine-server/notify-channels';
import { createMemoryHistory } from '@solidjs/router';

const DEFAULT_CLIENT_IDS = ['client-a', 'client-b'] as const;

function productHarnessClock(harness: Harness): ProductHarnessSession['clock'] {
  return {
    now: () => harness.clock.now(),
    advance: (ms: number) => {
      void harness.scheduler.runFor(ms).catch(() => {
        // ignore disposed harness
      });
    },
    reset: (ms: number) => {
      harness.scheduler.reset(ms);
    },
  };
}

export type BootProductHarnessOptions = {
  readonly skipSnapshotLoad?: boolean;
  /**
   * Product host. Default `in-process` (Solid DOM / mem SQL).
   * `bun-webview` embeds actor URLs (iframe) against a localhost sidecar.
   */
  readonly runtime?: 'in-process' | 'bun-webview';
};

export type ProductHarnessSessionBuildArgs = {
  readonly harness: Harness;
  /** Balancer ingress access log (method / path / status for every request). */
  readonly balancerLogs: ReturnType<typeof createProductHarnessLogBuffer>;
  readonly pubsubLogs: ReturnType<typeof createProductHarnessLogBuffer>;
  readonly roomLogs: ReturnType<typeof createProductHarnessLogBuffer>;
  readonly snapshotStore: ObjectStore;
  readonly disposeTick: () => void;
  readonly getClockPaused: () => boolean;
  readonly setClockPaused: (paused: boolean) => void;
  readonly skipSnapshotLoad?: boolean;
  readonly bindDomainWake?: (fire: (label: string) => void) => void;
  /** When set, actor panels embed this origin as a URL view (not the Solid App). */
  readonly actorWebOrigin?: string;
};

function liveToActor(args: {
  id: string;
  live: Client;
  logs: ReturnType<typeof createProductHarnessLogBuffer>;
  sqlClient: ProductHarnessActor['sqlClient'];
  history: ProductHarnessMemoryHistory;
  browser: HarnessBrowser;
  actorWebOrigin?: string;
}): ProductHarnessActor {
  return {
    id: args.id,
    address: args.id,
    sqlClient: args.sqlClient,
    logs: args.logs,
    view:
      args.actorWebOrigin !== undefined
        ? { kind: 'url', url: args.actorWebOrigin }
        : {
            kind: 'solid',
            App: harnessActorApp({
              live: args.live,
              browser: args.browser,
              isolateStyles: true,
            }),
            history: args.history,
          },
  };
}

async function createSeededMemoryHistory(
  live: Client
): Promise<ProductHarnessMemoryHistory> {
  const history = createMemoryHistory();
  const saved = await readEmbeddedHref(live.env.kv);
  if (saved !== null && saved !== history.get()) {
    history.set({ value: saved, replace: true });
  }
  return history;
}

async function exportProductHarnessSqlBytes(
  harness: Harness,
  maps: SessionMaps
): Promise<Readonly<Record<string, Uint8Array>>> {
  const out: Record<string, Uint8Array> = {
    server: await harness.serverSql.exportBytes(),
  };
  for (const id of maps.clients.keys()) {
    const handle = harness.clientSql(id);
    if (handle !== undefined) out[id] = await handle.exportBytes();
  }
  return out;
}

async function runProductHarnessCommand(
  buildArgs: ProductHarnessSessionBuildArgs,
  maps: SessionMaps,
  commands: ReturnType<typeof createProductHarnessChessCommands>,
  id: string
): Promise<void> {
  const cmd = commands.find((c) => c.id === id);
  if (cmd === undefined) throw new Error(`unknown command '${id}'`);
  const publishPeer = createInMemoryPublishOnlyPubSub({
    bus: buildArgs.harness.pubSubBus,
    logger: createLogger({
      name: 'product-harness:pubsub',
      now: () => buildArgs.harness.clock.now(),
    }),
  });
  try {
    await cmd.run({
      serverSql: buildArgs.harness.serverSql.sqlClient,
      now: () => buildArgs.harness.clock.now(),
      createId: buildArgs.harness.server.createId,
      setTimeout: (fn, ms) =>
        buildArgs.harness.server.timers.setTimeout(fn, ms),
      notifySyncWake: async (wake) => {
        await notifyChannels({
          pubsub: publishPeer,
          sql: buildArgs.harness.serverSql.sqlClient,
          topics: wake.topics as Topic[],
          now: () => buildArgs.harness.clock.now(),
          ...(wake.tables !== undefined && wake.tables.length > 0
            ? { tables: wake.tables }
            : {}),
          label: wake.label,
          schedulePublish: (run) => {
            buildArgs.harness.server.timers.setTimeout(run, 0);
          },
        });
      },
    });
  } finally {
    publishPeer.close();
  }
  fireDomainWake(maps, 'command');
}

function nextClientId(clients: Map<string, ProductHarnessActor>): string {
  return nextHarnessNodeId('client', new Set(clients.keys()));
}

async function spawnClient(
  args: ProductHarnessSessionBuildArgs,
  maps: SessionMaps,
  id?: string
): Promise<ProductHarnessActor> {
  const instanceId =
    id === undefined || id.trim() === ''
      ? nextClientId(maps.clients)
      : normalizeHarnessNodeId(id, 'client');
  if (maps.clients.has(instanceId)) {
    throw new Error(`harness client '${instanceId}' already exists`);
  }
  args.harness.restart(instanceId);
  const actorLogs = createProductHarnessLogBuffer();
  const base = await args.harness.client(instanceId);
  const live = await args.harness.spawnClient(instanceId, {
    ...base,
    server: loggingFetch(base.server, actorLogs, args.balancerLogs, () =>
      args.harness.clock.now()
    ),
  });
  await live.env.openSqlClient();
  const handle = args.harness.clientSql(instanceId);
  if (handle === undefined) {
    throw new Error(`harness client '${instanceId}' SQL missing`);
  }
  maps.lives.set(instanceId, live);
  const history = await createSeededMemoryHistory(live);
  const actor = liveToActor({
    id: instanceId,
    live,
    logs: actorLogs,
    sqlClient: handle.sqlClient,
    history,
    browser: args.harness.browser(instanceId),
    ...(args.actorWebOrigin !== undefined
      ? { actorWebOrigin: args.actorWebOrigin }
      : {}),
  });
  maps.clients.set(instanceId, actor);
  notify(maps);
  fireDomainWake(maps, 'spawn');
  return actor;
}

function makeSnapshotCtx(
  args: ProductHarnessSessionBuildArgs,
  maps: SessionMaps
): () => SnapshotSessionCtx {
  return () => ({
    store: args.snapshotStore,
    harness: args.harness,
    clock: args.harness.clock,
    scheduler: args.harness.scheduler,
    roomNode: args.harness.roomNode,
    serverHandle: args.harness.serverSql,
    clientSqlByAddress: new Map(),
    maps: {
      clients: maps.clients,
      lives: maps.lives,
    },
    getClockPaused: args.getClockPaused,
    setClockPaused: args.setClockPaused,
    spawnClient: (nextId?: string) => spawnClient(args, maps, nextId),
    refreshServers: () => {
      refreshProductHarnessServers(args.harness, maps);
    },
    detachClientsForSnapshotLoad: () =>
      detachClientsForSnapshotLoad(args.harness, maps),
    notify: () => notify(maps),
    endSnapshotRestoring: () => {
      maps.snapshotRestoring = false;
    },
    runQuiet: (fn) => runQuiet(maps, fn),
  });
}

type SessionApiAttachArgs = {
  readonly args: ProductHarnessSessionBuildArgs;
  readonly maps: SessionMaps;
  readonly commands: ReturnType<typeof createProductHarnessChessCommands>;
  readonly loadBalancer: ProductHarnessLoadBalancerNode;
  readonly sessionRef: { current: ProductHarnessSession | null };
  readonly snapshotCtx: () => SnapshotSessionCtx;
  readonly getSnapshotLoads: () => ProductHarnessPaletteCommand[];
  readonly setSnapshotLoads: (cmds: ProductHarnessPaletteCommand[]) => void;
  readonly markDisposed: () => void;
  readonly unsubRooms: () => void;
  readonly stopAutosave: () => void;
  readonly disposed: () => boolean;
};

function clearLiveClientDurables(
  harness: Harness,
  clientIds: Iterable<string>
): void {
  for (const id of clientIds) {
    clearProductHarnessClientDurable(harness.clientNamespace(id));
  }
}

async function deleteStickySnapshot(store: ObjectStore): Promise<void> {
  try {
    await deleteProductHarnessSnapshot(
      store,
      PRODUCT_HARNESS_STICKY_SNAPSHOT_ID
    );
  } catch {
    // Missing or store down — wipe still proceeds.
  }
}

function attachSessionApi(api: SessionApiAttachArgs): ProductHarnessSession {
  const { args: buildArgs, maps, commands, disposed } = api;
  const session: ProductHarnessSession = {
    clock: productHarnessClock(buildArgs.harness),
    crash: (id) => buildArgs.harness.crash(id),
    restart: (id) => buildArgs.harness.restart(id),
    partition: (a, b) => buildArgs.harness.partition(a, b),
    heal: (a, b) => buildArgs.harness.heal(a, b),
    clients: maps.clients,
    servers: maps.servers,
    loadBalancer: api.loadBalancer,
    pubsub: makeProductHarnessPubSubNode(
      buildArgs.harness.pubSubBus,
      buildArgs.pubsubLogs
    ),
    rooms: maps.rooms,
    get revision() {
      return maps.revision;
    },
    get snapshotEpoch() {
      return maps.snapshotEpoch;
    },
    get snapshotRestoring() {
      return maps.snapshotRestoring;
    },
    subscribe(listener) {
      maps.listeners.add(listener);
      return () => {
        maps.listeners.delete(listener);
      };
    },
    addClient: (id) => spawnClient(buildArgs, maps, id),
    removeClient: (id) => removeClient(buildArgs.harness, maps, id),
    addServer: (id) => addProductHarnessServer(buildArgs.harness, maps, id),
    removeServer: (id) =>
      removeProductHarnessServer(buildArgs.harness, maps, id),
    listCommands: () => commands,
    runCommand: (id) => runProductHarnessCommand(buildArgs, maps, commands, id),
    captureCheckpoint: (label) => captureCheckpoint(api.snapshotCtx(), label),
    restoreCheckpoint: (cp) => restoreCheckpoint(api.snapshotCtx(), cp),
    subscribeDomainWake(listener) {
      maps.domainWakeListeners.add(listener);
      return () => {
        maps.domainWakeListeners.delete(listener);
      };
    },
    setClockPaused: buildArgs.setClockPaused,
    isClockPaused: buildArgs.getClockPaused,
    exportSqlBytes: () => exportProductHarnessSqlBytes(buildArgs.harness, maps),
    async wipe() {
      if (disposed()) return;
      api.stopAutosave();
      const clientIds = [...maps.clients.keys()];
      clearLiveClientDurables(buildArgs.harness, clientIds);
      await deleteStickySnapshot(buildArgs.snapshotStore);
      await wipeSession(buildArgs, maps, api.markDisposed);
    },
    async dispose() {
      if (disposed()) return;
      api.stopAutosave();
      await disposeSession(buildArgs, maps, api.unsubRooms, api.markDisposed);
    },
    ...snapshotSessionMethods({
      snapshotStore: buildArgs.snapshotStore,
      sessionRef: api.sessionRef,
      snapshotCtx: api.snapshotCtx,
      getSnapshotLoads: api.getSnapshotLoads,
      setSnapshotLoads: api.setSnapshotLoads,
      commands,
      notify: () => notify(maps),
      fireDomainWake: (label) => fireDomainWake(maps, label),
    }),
  };
  return session;
}

async function bootClients(
  args: ProductHarnessSessionBuildArgs,
  maps: SessionMaps,
  session: ProductHarnessSession,
  setSnapshotLoads: (cmds: ProductHarnessPaletteCommand[]) => void
): Promise<void> {
  if (args.skipSnapshotLoad !== true) {
    try {
      const snaps = await listProductHarnessSnapshots(args.snapshotStore);
      const compatible = snaps.filter((s) => s.compatible);
      if (compatible.length > 0) {
        let newest = compatible[0]!;
        for (const s of compatible) {
          if (s.createdAtMs > newest.createdAtMs) newest = s;
        }
        await loadProductHarnessSnapshot(
          makeSnapshotCtx(args, maps)(),
          newest.id
        );
      }
      const cmds = await buildSnapshotLoadCommands(session);
      setSnapshotLoads(cmds);
    } catch {
      // Snapshot store down/slow — fall through to fresh default clients.
    }
  }
  if (maps.clients.size === 0) {
    for (const id of DEFAULT_CLIENT_IDS) {
      await spawnClient(args, maps, id);
    }
  }
}

export async function buildProductHarnessSession(
  args: ProductHarnessSessionBuildArgs
): Promise<ProductHarnessSession> {
  const maps: SessionMaps = {
    clients: new Map(),
    lives: new Map(),
    servers: new Map(),
    serverLogs: new Map(),
    rooms: new Map(),
    listeners: new Set(),
    revision: 0,
    snapshotEpoch: 0,
    snapshotRestoring: false,
    quietDepth: 0,
    domainWakeListeners: new Set(),
  };
  args.bindDomainWake?.((label) => fireDomainWake(maps, label));
  let disposed = false;
  const markDisposed = () => {
    disposed = true;
  };
  const unsubRooms = args.harness.roomNode.subscribe(() =>
    refreshRoomMap(args.harness.roomNode, maps, args.roomLogs)
  );
  const unsubRoutes = bindLoadBalancerRouteLogs({
    harness: args.harness,
    maps,
    balancerLogs: args.balancerLogs,
  });
  refreshProductHarnessServers(args.harness, maps);

  const commands = createProductHarnessChessCommands();
  let snapshotLoadCommands: ProductHarnessPaletteCommand[] = [];
  const sessionRef: { current: ProductHarnessSession | null } = {
    current: null,
  };
  let stopAutosave = (): void => {};

  const snapshotCtx = makeSnapshotCtx(args, maps);
  const session = attachSessionApi({
    args,
    maps,
    commands,
    loadBalancer: makeProductHarnessLoadBalancerNode(
      args.harness,
      args.balancerLogs
    ),
    sessionRef,
    snapshotCtx,
    getSnapshotLoads: () => snapshotLoadCommands,
    setSnapshotLoads: (cmds) => {
      snapshotLoadCommands = cmds;
    },
    markDisposed,
    unsubRooms: () => {
      unsubRooms();
      unsubRoutes();
    },
    stopAutosave: () => {
      stopAutosave();
    },
    disposed: () => disposed,
  });
  sessionRef.current = session;
  await bootClients(args, maps, session, (cmds) => {
    snapshotLoadCommands = cmds;
  });
  stopAutosave = installProductHarnessStickyAutosave({
    session,
    timers: args.harness.server.timers,
    snapshotCtx,
    disposed: () => disposed,
  });
  return session;
}
