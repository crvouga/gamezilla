/**
 * Session façade over a booted World + room node + SQL handles.
 */

import type { InProcessRoomNode } from '@apps/client/host/in-process-room-node';
import { createPlaygroundChessCommands } from '@apps/client/host/playground-chess-seed';
import {
  buildPlaygroundPaletteCommands,
  buildSnapshotLoadCommands,
} from '@apps/client/host/playground-fault-commands';
import {
  clearClientDurablePorts,
  type PlaygroundClientLive,
} from '@apps/client/host/playground-impls';
import {
  clientNamespace,
  type PlaygroundSqlHandle,
} from '@apps/client/host/playground-provide';
import {
  listPlaygroundSnapshots,
  loadPlaygroundSnapshot,
  type SnapshotSessionCtx,
  savePlaygroundSnapshot,
} from '@apps/client/host/playground-snapshots';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import type { SimIo } from '@pkgs/io';
import { clearNamespacedKvWeb } from '@pkgs/kv/impl-kv-web-namespaced';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { InMemoryBus } from '@pkgs/pubsub/testing/in-memory';
import type { World } from '@pkgs/system';
import type {
  createPlaygroundLogBuffer,
  PlaygroundActor,
  PlaygroundPaletteCommand,
  PlaygroundPubSubNode,
  PlaygroundRoomNode,
  PlaygroundSession,
  PlaygroundSqlNode,
} from '@pkgs/system-console/client';

const DEFAULT_CLIENT_IDS = ['alice', 'bob'] as const;

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
};

type SessionMaps = {
  readonly clients: Map<string, PlaygroundActor<ClientSystemResources>>;
  readonly lives: Map<string, PlaygroundClientLive>;
  readonly rooms: Map<string, PlaygroundRoomNode>;
  readonly listeners: Set<() => void>;
  /** >0 while snapshot restore (or similar) batches UI updates. */
  quietDepth: number;
};

function notify(maps: SessionMaps): void {
  if (maps.quietDepth > 0) return;
  for (const listener of [...maps.listeners]) {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  }
}

async function runQuiet<T>(
  maps: SessionMaps,
  fn: () => Promise<T>
): Promise<T> {
  maps.quietDepth += 1;
  try {
    return await fn();
  } finally {
    maps.quietDepth -= 1;
    notify(maps);
  }
}

function makeRoomNode(
  topic: string,
  roomNode: InProcessRoomNode,
  logs: ReturnType<typeof createPlaygroundLogBuffer>
): PlaygroundRoomNode {
  return {
    id: topic,
    address: `room:${topic}`,
    logs,
    inspect() {
      const snap = roomNode.inspect(topic);
      if (snap === null) return null;
      return {
        topic: snap.topic,
        committedState: snap.committedState,
        roster: snap.roster,
        lastSeq: snap.storage?.lastSeq ?? 0,
        entries: snap.storage?.entries ?? [],
        dedupSize: snap.storage?.dedupSize ?? 0,
      };
    },
  };
}

function makePubSubNode(
  bus: InMemoryBus,
  logs: ReturnType<typeof createPlaygroundLogBuffer>
): PlaygroundPubSubNode {
  return {
    id: 'events',
    address: 'events',
    logs,
    listTopicStats() {
      const byTopic = new Map<
        string,
        { subscriberCount: number; instanceCount: number }
      >();
      for (const instance of bus.listInstances()) {
        for (const row of instance.topicStatsForTest()) {
          const cur = byTopic.get(row.topic) ?? {
            subscriberCount: 0,
            instanceCount: 0,
          };
          cur.subscriberCount += row.subscriberCount;
          cur.instanceCount += 1;
          byTopic.set(row.topic, cur);
        }
      }
      return [...byTopic.entries()].map(([topic, stats]) => ({
        topic,
        subscriberCount: stats.subscriberCount,
        instanceCount: stats.instanceCount,
      }));
    },
  };
}

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

async function removeClient(
  world: World,
  maps: SessionMaps,
  clientSqlByAddress: Map<string, PlaygroundSqlHandle>,
  id: string
): Promise<void> {
  const live = maps.lives.get(id);
  if (live === undefined) return;
  await live.close();
  world.faults.crash(live.address);
  clearClientDurablePorts(id);
  clearNamespacedKvWeb(clientNamespace(id));
  const dbAddress = `${live.address}.db`;
  const handle = clientSqlByAddress.get(dbAddress);
  if (handle !== undefined) {
    await handle.reset();
    clientSqlByAddress.delete(dbAddress);
  }
  maps.lives.delete(id);
  maps.clients.delete(id);
  notify(maps);
}

function refreshRoomMap(
  roomNode: InProcessRoomNode,
  maps: SessionMaps,
  roomLogs: ReturnType<typeof createPlaygroundLogBuffer>
): void {
  const topics = roomNode.listTopics();
  let changed = false;
  for (const topic of topics) {
    if (!maps.rooms.has(topic)) {
      maps.rooms.set(topic, makeRoomNode(topic, roomNode, roomLogs));
      changed = true;
    }
  }
  for (const topic of [...maps.rooms.keys()]) {
    if (!topics.includes(topic)) {
      maps.rooms.delete(topic);
      changed = true;
    }
  }
  if (changed) notify(maps);
}

async function wipeSession(
  args: PlaygroundSessionBuildArgs,
  maps: SessionMaps,
  markDisposed: () => void
): Promise<void> {
  for (const live of maps.lives.values()) {
    await live.close();
    clearClientDurablePorts(live.id);
    clearNamespacedKvWeb(clientNamespace(live.id));
  }
  maps.lives.clear();
  maps.clients.clear();
  for (const handle of args.clientSqlByAddress.values()) {
    await handle.reset();
  }
  args.clientSqlByAddress.clear();
  await args.serverHandle.reset();
  args.roomNode.dispose();
  args.world.dispose();
  args.disposeTick();
  await args.serverHandle.disconnect();
  markDisposed();
  notify(maps);
}

async function disposeSession(
  args: PlaygroundSessionBuildArgs,
  maps: SessionMaps,
  unsubRooms: () => void,
  markDisposed: () => void
): Promise<void> {
  markDisposed();
  unsubRooms();
  for (const live of maps.lives.values()) await live.close();
  maps.lives.clear();
  maps.clients.clear();
  args.roomNode.dispose();
  args.world.dispose();
  args.disposeTick();
  for (const handle of args.clientSqlByAddress.values()) {
    await handle.disconnect();
  }
  args.clientSqlByAddress.clear();
  await args.serverHandle.disconnect();
  maps.listeners.clear();
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
    notify: () => notify(maps),
    runQuiet: (fn) => runQuiet(maps, fn),
  });
}

function attachSessionApi(args: {
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
}): PlaygroundSession<ClientSystemResources> {
  const {
    args: buildArgs,
    maps,
    commands,
    server,
    sessionRef,
    snapshotCtx,
    getSnapshotLoads,
    setSnapshotLoads,
    markDisposed,
    unsubRooms,
    disposed,
  } = args;

  const session: PlaygroundSession<ClientSystemResources> = {
    world: buildArgs.world,
    io: buildArgs.io,
    clients: maps.clients,
    server,
    pubsub: makePubSubNode(buildArgs.pubSubBus, buildArgs.pubsubLogs),
    rooms: maps.rooms,
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
      await cmd.run({
        serverSql: buildArgs.serverHandle.sqlClient,
        io: buildArgs.io,
      });
    },
    listPaletteCommands() {
      const live = sessionRef.current ?? session;
      const seed: PlaygroundPaletteCommand[] = commands.map((c) => ({
        id: `cmd:${c.id}`,
        title: c.label,
        category: 'Commands',
        keywords: [c.id, c.label],
        run: () => live.runCommand(c.id),
      }));
      return [
        ...buildPlaygroundPaletteCommands(live),
        ...getSnapshotLoads(),
        ...seed,
      ];
    },
    async refreshSnapshotPaletteCommands() {
      const live = sessionRef.current ?? session;
      setSnapshotLoads(await buildSnapshotLoadCommands(live));
      notify(maps);
    },
    listSnapshots: () => listPlaygroundSnapshots(buildArgs.snapshotStore),
    saveSnapshot: async (label) => {
      const info = await savePlaygroundSnapshot(snapshotCtx(), label);
      const live = sessionRef.current ?? session;
      setSnapshotLoads(await buildSnapshotLoadCommands(live));
      notify(maps);
      return info;
    },
    loadSnapshot: (id) => loadPlaygroundSnapshot(snapshotCtx(), id),
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
  };
  return session;
}

export async function buildPlaygroundSession(
  args: PlaygroundSessionBuildArgs
): Promise<PlaygroundSession<ClientSystemResources>> {
  const maps: SessionMaps = {
    clients: new Map(),
    lives: new Map(),
    rooms: new Map(),
    listeners: new Set(),
    quietDepth: 0,
  };
  let disposed = false;
  const markDisposed = () => {
    disposed = true;
  };
  const unsubRooms = args.roomNode.subscribe(() =>
    refreshRoomMap(args.roomNode, maps, args.roomLogs)
  );

  for (const id of DEFAULT_CLIENT_IDS) {
    await spawnClient(args.world, maps, id);
  }

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
  // Do not await MinIO here — a down/slow MinIO stalls boot and races OPFS
  // opens under React Strict Mode remounts. Snapshot strip refreshes lazily.
  return session;
}
