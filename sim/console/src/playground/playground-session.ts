/**
 * Session façade over createSim + room node + snapshot store.
 */

import type { Client } from '@apps/client/product/create-client';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { Topic } from '@pkgs/pubsub/interface';
import { createInMemoryPublishOnlyPubSub } from '@pkgs/pubsub/testing/in-memory';
import {
  createPlaygroundLogBuffer,
  type PlaygroundActor,
  type PlaygroundPaletteCommand,
  type PlaygroundSession,
  type PlaygroundSqlNode,
} from '@pkgs/sim-console/client';
import { notifyChannels } from '@pkgs/sync-engine/server';
import {
  captureCheckpoint,
  restoreCheckpoint,
} from '@sim/console/playground/playground-checkpoint';
import { clearPlaygroundClientDurable } from '@sim/console/playground/playground-checkpoint-durable';
import { createPlaygroundChessCommands } from '@sim/console/playground/playground-chess-seed';
import { buildSnapshotLoadCommands } from '@sim/console/playground/playground-fault-commands';
import { loggingFetch } from '@sim/console/playground/playground-logging-fetch';
import { makePlaygroundPubSubNode } from '@sim/console/playground/playground-session-nodes';
import { snapshotSessionMethods } from '@sim/console/playground/playground-session-snapshot-api';
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
} from '@sim/console/playground/playground-session-teardown';
import {
  deletePlaygroundSnapshot,
  listPlaygroundSnapshots,
  loadPlaygroundSnapshot,
  PLAYGROUND_STICKY_SNAPSHOT_ID,
  type SnapshotSessionCtx,
} from '@sim/console/playground/playground-snapshots';
import { installPlaygroundStickyAutosave } from '@sim/console/playground/playground-sticky-autosave';
import { type Sim, simClientNamespace } from '@sim/console/sim/create-sim';

const DEFAULT_CLIENT_IDS = ['alice', 'bob'] as const;

export type BootPlaygroundOptions = {
  readonly skipSnapshotLoad?: boolean;
};

export type PlaygroundSessionBuildArgs = {
  readonly sim: Sim;
  readonly serverLogs: ReturnType<typeof createPlaygroundLogBuffer>;
  readonly pubsubLogs: ReturnType<typeof createPlaygroundLogBuffer>;
  readonly roomLogs: ReturnType<typeof createPlaygroundLogBuffer>;
  readonly snapshotStore: ObjectStore;
  readonly disposeTick: () => void;
  readonly getClockPaused: () => boolean;
  readonly setClockPaused: (paused: boolean) => void;
  readonly skipSnapshotLoad?: boolean;
  readonly bindDomainWake?: (fire: (label: string) => void) => void;
};

function liveToActor(
  id: string,
  live: Client,
  logs: ReturnType<typeof createPlaygroundLogBuffer>,
  sqlClient: PlaygroundActor['sqlClient']
): PlaygroundActor {
  return {
    id,
    address: id,
    sqlClient,
    logs,
    App: live.App,
  };
}

async function exportPlaygroundSqlBytes(
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

async function runPlaygroundCommand(
  buildArgs: PlaygroundSessionBuildArgs,
  maps: SessionMaps,
  commands: ReturnType<typeof createPlaygroundChessCommands>,
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

function nextClientId(clients: Map<string, PlaygroundActor>): string {
  let n = clients.size + 1;
  let id = `client-${n}`;
  while (clients.has(id)) {
    n += 1;
    id = `client-${n}`;
  }
  return id;
}

async function spawnClient(
  args: PlaygroundSessionBuildArgs,
  maps: SessionMaps,
  id?: string
): Promise<PlaygroundActor> {
  const instanceId = id?.trim() || nextClientId(maps.clients);
  if (maps.clients.has(instanceId)) {
    throw new Error(`playground client '${instanceId}' already exists`);
  }
  args.sim.restart(instanceId);
  const actorLogs = createPlaygroundLogBuffer();
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
    throw new Error(`playground client '${instanceId}' SQL missing`);
  }
  maps.lives.set(instanceId, live);
  const actor = liveToActor(instanceId, live, actorLogs, handle.sqlClient);
  maps.clients.set(instanceId, actor);
  notify(maps);
  fireDomainWake(maps, 'spawn');
  return actor;
}

function makeSnapshotCtx(
  args: PlaygroundSessionBuildArgs,
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
  readonly args: PlaygroundSessionBuildArgs;
  readonly maps: SessionMaps;
  readonly commands: ReturnType<typeof createPlaygroundChessCommands>;
  readonly server: PlaygroundSqlNode;
  readonly sessionRef: { current: PlaygroundSession | null };
  readonly snapshotCtx: () => SnapshotSessionCtx;
  readonly getSnapshotLoads: () => PlaygroundPaletteCommand[];
  readonly setSnapshotLoads: (cmds: PlaygroundPaletteCommand[]) => void;
  readonly markDisposed: () => void;
  readonly unsubRooms: () => void;
  readonly stopAutosave: () => void;
  readonly disposed: () => boolean;
};

function clearLiveClientDurables(clientIds: Iterable<string>): void {
  for (const id of clientIds) {
    clearPlaygroundClientDurable(simClientNamespace(id));
  }
}

async function deleteStickySnapshot(store: ObjectStore): Promise<void> {
  try {
    await deletePlaygroundSnapshot(store, PLAYGROUND_STICKY_SNAPSHOT_ID);
  } catch {
    // Missing or store down — wipe still proceeds.
  }
}

function attachSessionApi(api: SessionApiAttachArgs): PlaygroundSession {
  const { args: buildArgs, maps, commands, server, disposed } = api;
  const session: PlaygroundSession = {
    clock: buildArgs.sim.clock,
    crash: (id) => buildArgs.sim.crash(id),
    restart: (id) => buildArgs.sim.restart(id),
    partition: (a, b) => buildArgs.sim.partition(a, b),
    heal: (a, b) => buildArgs.sim.heal(a, b),
    clients: maps.clients,
    server,
    pubsub: makePlaygroundPubSubNode(
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
    runCommand: (id) => runPlaygroundCommand(buildArgs, maps, commands, id),
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
    exportSqlBytes: () => exportPlaygroundSqlBytes(buildArgs.sim, maps),
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
  args: PlaygroundSessionBuildArgs,
  maps: SessionMaps,
  session: PlaygroundSession,
  setSnapshotLoads: (cmds: PlaygroundPaletteCommand[]) => void
): Promise<void> {
  if (args.skipSnapshotLoad !== true) {
    try {
      const snaps = await listPlaygroundSnapshots(args.snapshotStore);
      const compatible = snaps.filter((s) => s.compatible);
      if (compatible.length > 0) {
        let newest = compatible[0]!;
        for (const s of compatible) {
          if (s.createdAtMs > newest.createdAtMs) newest = s;
        }
        await loadPlaygroundSnapshot(makeSnapshotCtx(args, maps)(), newest.id);
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

export async function buildPlaygroundSession(
  args: PlaygroundSessionBuildArgs
): Promise<PlaygroundSession> {
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

  const commands = createPlaygroundChessCommands();
  let snapshotLoadCommands: PlaygroundPaletteCommand[] = [];
  const sessionRef: { current: PlaygroundSession | null } = { current: null };
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
  stopAutosave = installPlaygroundStickyAutosave({
    session,
    timers: args.sim.server.timers,
    snapshotCtx,
    disposed: () => disposed,
  });
  return session;
}
