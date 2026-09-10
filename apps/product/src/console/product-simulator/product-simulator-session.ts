/**
 * Session façade over createSim + room node + snapshot store.
 */

import type { Client } from '@apps/client/shell/create-client';
import {
  captureCheckpoint,
  restoreCheckpoint,
} from '@apps/product/product-simulator/product-simulator-checkpoint';
import { createProductSimulatorChessCommands } from '@apps/product/product-simulator/product-simulator-chess-seed';
import { buildSnapshotLoadCommands } from '@apps/product/product-simulator/product-simulator-fault-commands';
import { loggingFetch } from '@apps/product/product-simulator/product-simulator-logging-fetch';
import { makeProductSimulatorPubSubNode } from '@apps/product/product-simulator/product-simulator-session-nodes';
import { snapshotSessionMethods } from '@apps/product/product-simulator/product-simulator-session-snapshot-api';
import {
  detachClientsForSnapshotLoad,
  disposeSession,
  fireDomainWake,
  notify,
  refreshRoomMap,
  removeClient,
  runQuiet,
  type SessionMaps,
  wipeSession,
} from '@apps/product/product-simulator/product-simulator-session-teardown';
import {
  deleteProductSimulatorSnapshot,
  listProductSimulatorSnapshots,
  loadProductSimulatorSnapshot,
  PRODUCT_SIMULATOR_STICKY_SNAPSHOT_ID,
  type SnapshotSessionCtx,
} from '@apps/product/product-simulator/product-simulator-snapshots';
import { installProductSimulatorStickyAutosave } from '@apps/product/product-simulator/product-simulator-sticky-autosave';
import { clearProductSimulatorClientDurable } from '@apps/product/sim/fabric/client-durable';
import {
  type Sim,
  simClientNamespace,
} from '@apps/product/sim/fabric/create-sim';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { createInMemoryPublishOnlyPubSub } from '@pkgs/pubsub/in-memory';
import type { Topic } from '@pkgs/pubsub/interface';
import {
  createProductSimulatorLogBuffer,
  type ProductSimulatorActor,
  type ProductSimulatorPaletteCommand,
  type ProductSimulatorSession,
  type ProductSimulatorSqlNode,
} from '@pkgs/sim-console/client';
import { notifyChannels } from '@pkgs/sync-engine/server';

const DEFAULT_CLIENT_IDS = ['alice', 'bob'] as const;

function productSimulatorClock(sim: Sim): ProductSimulatorSession['clock'] {
  return {
    now: () => sim.clock.now(),
    advance: (ms: number) => {
      void sim.scheduler.runFor(ms).catch(() => {
        // ignore disposed sim
      });
    },
    reset: (ms: number) => {
      sim.scheduler.reset(ms);
    },
  };
}

export type BootProductSimulatorOptions = {
  readonly skipSnapshotLoad?: boolean;
  /**
   * Product host. Default `in-process` (Solid DOM / mem SQL).
   * `bun-webview` embeds actor URLs (iframe) against a localhost sidecar.
   */
  readonly runtime?: 'in-process' | 'bun-webview';
};

export type ProductSimulatorSessionBuildArgs = {
  readonly sim: Sim;
  readonly serverLogs: ReturnType<typeof createProductSimulatorLogBuffer>;
  readonly pubsubLogs: ReturnType<typeof createProductSimulatorLogBuffer>;
  readonly roomLogs: ReturnType<typeof createProductSimulatorLogBuffer>;
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
  logs: ReturnType<typeof createProductSimulatorLogBuffer>;
  sqlClient: ProductSimulatorActor['sqlClient'];
  actorWebOrigin?: string;
}): ProductSimulatorActor {
  return {
    id: args.id,
    address: args.id,
    sqlClient: args.sqlClient,
    logs: args.logs,
    view:
      args.actorWebOrigin !== undefined
        ? { kind: 'url', url: args.actorWebOrigin }
        : { kind: 'solid', App: args.live.App },
  };
}

async function exportProductSimulatorSqlBytes(
  sim: Sim,
  maps: SessionMaps
): Promise<Readonly<Record<string, Uint8Array>>> {
  const out: Record<string, Uint8Array> = {
    server: await sim.serverSql.exportBytes(),
  };
  for (const id of maps.clients.keys()) {
    const handle = sim.clientSql(id);
    if (handle !== undefined) out[id] = await handle.exportBytes();
  }
  return out;
}

async function runProductSimulatorCommand(
  buildArgs: ProductSimulatorSessionBuildArgs,
  maps: SessionMaps,
  commands: ReturnType<typeof createProductSimulatorChessCommands>,
  id: string
): Promise<void> {
  const cmd = commands.find((c) => c.id === id);
  if (cmd === undefined) throw new Error(`unknown command '${id}'`);
  const publishPeer = createInMemoryPublishOnlyPubSub(buildArgs.sim.pubSubBus);
  try {
    await cmd.run({
      serverSql: buildArgs.sim.serverSql.sqlClient,
      now: () => buildArgs.sim.clock.now(),
      createId: buildArgs.sim.server.createId,
      setTimeout: (fn, ms) => buildArgs.sim.server.timers.setTimeout(fn, ms),
      notifySyncWake: async (wake) => {
        await notifyChannels({
          pubsub: publishPeer,
          sql: buildArgs.sim.serverSql.sqlClient,
          topics: wake.topics as Topic[],
          now: () => buildArgs.sim.clock.now(),
          ...(wake.tables !== undefined && wake.tables.length > 0
            ? { tables: wake.tables }
            : {}),
          label: wake.label,
          schedulePublish: (run) => {
            buildArgs.sim.server.timers.setTimeout(run, 0);
          },
        });
      },
    });
  } finally {
    publishPeer.close();
  }
  fireDomainWake(maps, 'command');
}

function nextClientId(clients: Map<string, ProductSimulatorActor>): string {
  let n = clients.size + 1;
  let id = `client-${n}`;
  while (clients.has(id)) {
    n += 1;
    id = `client-${n}`;
  }
  return id;
}

async function spawnClient(
  args: ProductSimulatorSessionBuildArgs,
  maps: SessionMaps,
  id?: string
): Promise<ProductSimulatorActor> {
  const instanceId = id?.trim() || nextClientId(maps.clients);
  if (maps.clients.has(instanceId)) {
    throw new Error(`simulator client '${instanceId}' already exists`);
  }
  args.sim.restart(instanceId);
  const actorLogs = createProductSimulatorLogBuffer();
  const base = args.sim.client(instanceId);
  const live = args.sim.spawnClient(instanceId, {
    ...base,
    server: loggingFetch(base.server, actorLogs, args.serverLogs, () =>
      args.sim.clock.now()
    ),
  });
  await live.env.openSqlClient();
  const handle = args.sim.clientSql(instanceId);
  if (handle === undefined) {
    throw new Error(`simulator client '${instanceId}' SQL missing`);
  }
  maps.lives.set(instanceId, live);
  const actor = liveToActor({
    id: instanceId,
    live,
    logs: actorLogs,
    sqlClient: handle.sqlClient,
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
  args: ProductSimulatorSessionBuildArgs,
  maps: SessionMaps
): () => SnapshotSessionCtx {
  return () => ({
    store: args.snapshotStore,
    sim: args.sim,
    clock: args.sim.clock,
    scheduler: args.sim.scheduler,
    roomNode: args.sim.roomNode,
    serverHandle: args.sim.serverSql,
    clientSqlByAddress: new Map(),
    maps: {
      clients: maps.clients,
      lives: maps.lives,
    },
    getClockPaused: args.getClockPaused,
    setClockPaused: args.setClockPaused,
    spawnClient: (nextId?: string) => spawnClient(args, maps, nextId),
    detachClientsForSnapshotLoad: () =>
      detachClientsForSnapshotLoad(args.sim, maps),
    notify: () => notify(maps),
    endSnapshotRestoring: () => {
      maps.snapshotRestoring = false;
    },
    runQuiet: (fn) => runQuiet(maps, fn),
  });
}

type SessionApiAttachArgs = {
  readonly args: ProductSimulatorSessionBuildArgs;
  readonly maps: SessionMaps;
  readonly commands: ReturnType<typeof createProductSimulatorChessCommands>;
  readonly server: ProductSimulatorSqlNode;
  readonly sessionRef: { current: ProductSimulatorSession | null };
  readonly snapshotCtx: () => SnapshotSessionCtx;
  readonly getSnapshotLoads: () => ProductSimulatorPaletteCommand[];
  readonly setSnapshotLoads: (cmds: ProductSimulatorPaletteCommand[]) => void;
  readonly markDisposed: () => void;
  readonly unsubRooms: () => void;
  readonly stopAutosave: () => void;
  readonly disposed: () => boolean;
};

function clearLiveClientDurables(clientIds: Iterable<string>): void {
  for (const id of clientIds) {
    clearProductSimulatorClientDurable(simClientNamespace(id));
  }
}

async function deleteStickySnapshot(store: ObjectStore): Promise<void> {
  try {
    await deleteProductSimulatorSnapshot(
      store,
      PRODUCT_SIMULATOR_STICKY_SNAPSHOT_ID
    );
  } catch {
    // Missing or store down — wipe still proceeds.
  }
}

function attachSessionApi(api: SessionApiAttachArgs): ProductSimulatorSession {
  const { args: buildArgs, maps, commands, server, disposed } = api;
  const session: ProductSimulatorSession = {
    clock: productSimulatorClock(buildArgs.sim),
    crash: (id) => buildArgs.sim.crash(id),
    restart: (id) => buildArgs.sim.restart(id),
    partition: (a, b) => buildArgs.sim.partition(a, b),
    heal: (a, b) => buildArgs.sim.heal(a, b),
    clients: maps.clients,
    server,
    pubsub: makeProductSimulatorPubSubNode(
      buildArgs.sim.pubSubBus,
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
    removeClient: (id) => removeClient(buildArgs.sim, maps, id),
    listCommands: () => commands,
    runCommand: (id) =>
      runProductSimulatorCommand(buildArgs, maps, commands, id),
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
    exportSqlBytes: () => exportProductSimulatorSqlBytes(buildArgs.sim, maps),
    async wipe() {
      if (disposed()) return;
      api.stopAutosave();
      const clientIds = [...maps.clients.keys()];
      clearLiveClientDurables(clientIds);
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
  args: ProductSimulatorSessionBuildArgs,
  maps: SessionMaps,
  session: ProductSimulatorSession,
  setSnapshotLoads: (cmds: ProductSimulatorPaletteCommand[]) => void
): Promise<void> {
  if (args.skipSnapshotLoad !== true) {
    try {
      const snaps = await listProductSimulatorSnapshots(args.snapshotStore);
      const compatible = snaps.filter((s) => s.compatible);
      if (compatible.length > 0) {
        let newest = compatible[0]!;
        for (const s of compatible) {
          if (s.createdAtMs > newest.createdAtMs) newest = s;
        }
        await loadProductSimulatorSnapshot(
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

export async function buildProductSimulatorSession(
  args: ProductSimulatorSessionBuildArgs
): Promise<ProductSimulatorSession> {
  const maps: SessionMaps = {
    clients: new Map(),
    lives: new Map(),
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
  const unsubRooms = args.sim.roomNode.subscribe(() =>
    refreshRoomMap(args.sim.roomNode, maps, args.roomLogs)
  );

  const commands = createProductSimulatorChessCommands();
  let snapshotLoadCommands: ProductSimulatorPaletteCommand[] = [];
  const sessionRef: { current: ProductSimulatorSession | null } = {
    current: null,
  };
  let stopAutosave = (): void => {};

  const snapshotCtx = makeSnapshotCtx(args, maps);
  const session = attachSessionApi({
    args,
    maps,
    commands,
    server: {
      id: 'server',
      address: 'server',
      sqlClient: args.sim.serverSql.sqlClient,
      logs: args.serverLogs,
    },
    sessionRef,
    snapshotCtx,
    getSnapshotLoads: () => snapshotLoadCommands,
    setSnapshotLoads: (cmds) => {
      snapshotLoadCommands = cmds;
    },
    markDisposed,
    unsubRooms,
    stopAutosave: () => {
      stopAutosave();
    },
    disposed: () => disposed,
  });
  sessionRef.current = session;
  await bootClients(args, maps, session, (cmds) => {
    snapshotLoadCommands = cmds;
  });
  stopAutosave = installProductSimulatorStickyAutosave({
    session,
    timers: args.sim.server.timers,
    snapshotCtx,
    disposed: () => disposed,
  });
  return session;
}
