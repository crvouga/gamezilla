/**
 * Session façade over a booted World + room node + SQL handles.
 */

import type { InProcessRoomNode } from '@apps/client/host/in-process-room-node';
import { createPlaygroundChessCommands } from '@apps/client/host/playground-chess-seed';
import { buildSnapshotLoadCommands } from '@apps/client/host/playground-fault-commands';
import type { PlaygroundClientLive } from '@apps/client/host/playground-impls';
import type { PlaygroundSqlHandle } from '@apps/client/host/playground-provide';
import { makePlaygroundPubSubNode } from '@apps/client/host/playground-session-nodes';
import { snapshotSessionMethods } from '@apps/client/host/playground-session-snapshot-api';
import {
  detachClientsForSnapshotLoad,
  disposeSession,
  notify,
  refreshRoomMap,
  removeClient,
  runQuiet,
  type SessionMaps,
  wipeSession,
} from '@apps/client/host/playground-session-teardown';
import {
  listPlaygroundSnapshots,
  loadPlaygroundSnapshot,
  type SnapshotSessionCtx,
} from '@apps/client/host/playground-snapshots';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import type { SimIo } from '@pkgs/io';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { Topic } from '@pkgs/pubsub/interface';
import {
  createInMemoryPublishOnlyPubSub,
  type InMemoryBus,
} from '@pkgs/pubsub/testing/in-memory';
import { notifyChannels } from '@pkgs/sync-engine/server';
import type { World } from '@pkgs/system';
import type {
  createPlaygroundLogBuffer,
  PlaygroundActor,
  PlaygroundPaletteCommand,
  PlaygroundSession,
  PlaygroundSqlNode,
} from '@pkgs/system-console/client';

const DEFAULT_CLIENT_IDS = ['alice', 'bob'] as const;

export type BootPlaygroundOptions = {
  /** After wipe: reboot a fresh session without loading the newest snapshot. */
  readonly skipSnapshotLoad?: boolean;
};

export type PlaygroundSessionBuildArgs = {
  readonly world: World;
  readonly io: SimIo;
  readonly roomNode: InProcessRoomNode;
  readonly pubSubBus: InMemoryBus;
  readonly serverHandle: PlaygroundSqlHandle;
  readonly clientSqlByAddress: Map<string, PlaygroundSqlHandle>;
  readonly serverLogs: ReturnType<typeof createPlaygroundLogBuffer>;
  readonly pubsubLogs: ReturnType<typeof createPlaygroundLogBuffer>;
  readonly roomLogs: ReturnType<typeof createPlaygroundLogBuffer>;
  readonly snapshotStore: ObjectStore;
  readonly disposeTick: () => void;
  readonly getClockPaused: () => boolean;
  readonly setClockPaused: (paused: boolean) => void;
  readonly skipSnapshotLoad?: boolean;
};

function liveToActor(
  live: PlaygroundClientLive
): PlaygroundActor<ClientSystemResources> {
  return {
    id: live.id,
    address: live.address,
    io: live.io,
    resources: live.resources,
    sqlClient: live.sqlClient,
    logs: live.logs,
  };
}

function nextClientId(
  clients: Map<string, PlaygroundActor<ClientSystemResources>>
): string {
  let n = clients.size + 1;
  let id = `client-${n}`;
  while (clients.has(id)) {
    n += 1;
    id = `client-${n}`;
  }
  return id;
}

async function spawnClient(
  world: World,
  maps: SessionMaps,
  id?: string
): Promise<PlaygroundActor<ClientSystemResources>> {
  const instanceId = id?.trim() || nextClientId(maps.clients);
  if (maps.clients.has(instanceId)) {
    throw new Error(`playground client '${instanceId}' already exists`);
  }
  world.faults.restart(`client:${instanceId}`);
  const live = await world.spawn<PlaygroundClientLive>('client', instanceId);
  maps.lives.set(instanceId, live);
  const actor = liveToActor(live);
  maps.clients.set(instanceId, actor);
  notify(maps);
  return actor;
}

function makeSnapshotCtx(
  args: PlaygroundSessionBuildArgs,
  maps: SessionMaps
): () => SnapshotSessionCtx {
  return () => ({
    store: args.snapshotStore,
    world: args.world,
    io: args.io,
    roomNode: args.roomNode,
    serverHandle: args.serverHandle,
    clientSqlByAddress: args.clientSqlByAddress,
    maps: {
      clients: maps.clients,
      lives: maps.lives,
      listeners: maps.listeners,
    },
    getClockPaused: args.getClockPaused,
    setClockPaused: args.setClockPaused,
    spawnClient: (id) => spawnClient(args.world, maps, id),
    removeClient: (id) =>
      removeClient(args.world, maps, args.clientSqlByAddress, id),
    detachClientsForSnapshotLoad: () =>
      detachClientsForSnapshotLoad(args.world, maps, args.clientSqlByAddress),
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
  readonly sessionRef: {
    current: PlaygroundSession<ClientSystemResources> | null;
  };
  readonly snapshotCtx: () => SnapshotSessionCtx;
  readonly getSnapshotLoads: () => PlaygroundPaletteCommand[];
  readonly setSnapshotLoads: (cmds: PlaygroundPaletteCommand[]) => void;
  readonly markDisposed: () => void;
  readonly unsubRooms: () => void;
  readonly disposed: () => boolean;
};

function attachSessionApi(
  args: SessionApiAttachArgs
): PlaygroundSession<ClientSystemResources> {
  const {
    args: buildArgs,
    maps,
    commands,
    server,
    markDisposed,
    unsubRooms,
    disposed,
  } = args;

  const session: PlaygroundSession<ClientSystemResources> = {
    world: buildArgs.world,
    io: buildArgs.io,
    clients: maps.clients,
    server,
    pubsub: makePlaygroundPubSubNode(buildArgs.pubSubBus, buildArgs.pubsubLogs),
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
    addClient: (id) => spawnClient(buildArgs.world, maps, id),
    removeClient: (id) =>
      removeClient(buildArgs.world, maps, buildArgs.clientSqlByAddress, id),
    listCommands: () => commands,
    async runCommand(id) {
      const cmd = commands.find((c) => c.id === id);
      if (cmd === undefined) throw new Error(`unknown command '${id}'`);
      const publishPeer = createInMemoryPublishOnlyPubSub(buildArgs.pubSubBus);
      try {
        await cmd.run({
          serverSql: buildArgs.serverHandle.sqlClient,
          io: buildArgs.io,
          notifySyncWake: async (wake) => {
            await notifyChannels({
              pubsub: publishPeer,
              sql: buildArgs.serverHandle.sqlClient,
              topics: wake.topics as Topic[],
              ...(wake.tables !== undefined && wake.tables.length > 0
                ? { tables: wake.tables }
                : {}),
              label: wake.label,
              schedulePublish: (run) => {
                buildArgs.io.timers.setTimeout(run, 0);
              },
            });
          },
        });
      } finally {
        publishPeer.close();
      }
    },
    setClockPaused: buildArgs.setClockPaused,
    isClockPaused: buildArgs.getClockPaused,
    async wipe() {
      if (disposed()) return;
      await wipeSession(buildArgs, maps, markDisposed);
    },
    async dispose() {
      if (disposed()) return;
      await disposeSession(buildArgs, maps, unsubRooms, markDisposed);
    },
    ...snapshotSessionMethods({
      snapshotStore: buildArgs.snapshotStore,
      sessionRef: args.sessionRef,
      snapshotCtx: args.snapshotCtx,
      getSnapshotLoads: args.getSnapshotLoads,
      setSnapshotLoads: args.setSnapshotLoads,
      commands,
      notify: () => notify(maps),
    }),
  };
  return session;
}

async function bootClients(
  args: PlaygroundSessionBuildArgs,
  maps: SessionMaps,
  session: PlaygroundSession<ClientSystemResources>,
  setSnapshotLoads: (cmds: PlaygroundPaletteCommand[]) => void
): Promise<void> {
  if (args.skipSnapshotLoad !== true) {
    try {
      const snaps = await listPlaygroundSnapshots(args.snapshotStore);
      if (snaps.length > 0) {
        let newest = snaps[0]!;
        for (const s of snaps) {
          if (s.createdAtMs > newest.createdAtMs) newest = s;
        }
        // Restore before any ProductApp spawn so AuthBridge cannot race the
        // durable namespace (pre-spawn + load was clobbering sessionToken).
        await loadPlaygroundSnapshot(makeSnapshotCtx(args, maps)(), newest.id);
      }
      setSnapshotLoads(await buildSnapshotLoadCommands(session));
    } catch {
      // Snapshot store down/slow — fall through to fresh default clients.
    }
  }
  // Empty / pre-client snapshots used to leave the Client pane blank with no
  // UI to add them back — always seed the default pair in that case.
  if (maps.clients.size === 0) {
    for (const id of DEFAULT_CLIENT_IDS) {
      await spawnClient(args.world, maps, id);
    }
  }
}

export async function buildPlaygroundSession(
  args: PlaygroundSessionBuildArgs
): Promise<PlaygroundSession<ClientSystemResources>> {
  const maps: SessionMaps = {
    clients: new Map(),
    lives: new Map(),
    rooms: new Map(),
    listeners: new Set(),
    revision: 0,
    snapshotEpoch: 0,
    snapshotRestoring: false,
    quietDepth: 0,
  };
  let disposed = false;
  const markDisposed = () => {
    disposed = true;
  };
  const unsubRooms = args.roomNode.subscribe(() =>
    refreshRoomMap(args.roomNode, maps, args.roomLogs)
  );

  const commands = createPlaygroundChessCommands();
  let snapshotLoadCommands: PlaygroundPaletteCommand[] = [];
  const sessionRef: {
    current: PlaygroundSession<ClientSystemResources> | null;
  } = { current: null };

  const session = attachSessionApi({
    args,
    maps,
    commands,
    server: {
      id: 'api',
      address: 'api',
      sqlClient: args.serverHandle.sqlClient,
      logs: args.serverLogs,
    },
    sessionRef,
    snapshotCtx: makeSnapshotCtx(args, maps),
    getSnapshotLoads: () => snapshotLoadCommands,
    setSnapshotLoads: (cmds) => {
      snapshotLoadCommands = cmds;
    },
    markDisposed,
    unsubRooms,
    disposed: () => disposed,
  });
  sessionRef.current = session;
  await bootClients(args, maps, session, (cmds) => {
    snapshotLoadCommands = cmds;
  });
  return session;
}
