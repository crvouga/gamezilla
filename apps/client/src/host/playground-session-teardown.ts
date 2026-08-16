/**
 * Session map notify / quiet batching + client SQL teardown for playground.
 */

import type { InProcessRoomNode } from '@apps/client/host/in-process-room-node';
import {
  clearClientDurablePorts,
  type PlaygroundClientLive,
} from '@apps/client/host/playground-impls';
import type { PlaygroundSqlHandle } from '@apps/client/host/playground-provide';
import { makePlaygroundRoomNode } from '@apps/client/host/playground-session-nodes';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import type { World } from '@pkgs/system';
import type {
  createPlaygroundLogBuffer,
  PlaygroundActor,
  PlaygroundRoomNode,
} from '@pkgs/system-console/client';

/** Handles required to wipe / dispose a playground session. */
export type SessionTeardownArgs = {
  readonly world: World;
  readonly roomNode: InProcessRoomNode;
  readonly serverHandle: PlaygroundSqlHandle;
  readonly clientSqlByAddress: Map<string, PlaygroundSqlHandle>;
  readonly disposeTick: () => void;
};

export type SessionMaps = {
  readonly clients: Map<string, PlaygroundActor<ClientSystemResources>>;
  readonly lives: Map<string, PlaygroundClientLive>;
  readonly rooms: Map<string, PlaygroundRoomNode>;
  readonly listeners: Set<() => void>;
  /** Bumped on every UI notify so subscribers re-render after restores. */
  revision: number;
  /**
   * Bumped only when leaving snapshot `runQuiet` so ProductApp remounts after
   * restore — not on every room/client notify (those must not tear down live UI).
   */
  snapshotEpoch: number;
  /**
   * True while snapshot teardown/restore runs. UI must paint zero clients so
   * SyncEngineBoot cannot migrate a DB that detach is concurrently destroying.
   */
  snapshotRestoring: boolean;
  /** >0 while snapshot restore (or similar) batches UI updates. */
  quietDepth: number;
};

export function notify(maps: SessionMaps): void {
  if (maps.quietDepth > 0) return;
  maps.revision += 1;
  for (const listener of [...maps.listeners]) {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  }
}

export async function runQuiet<T>(
  maps: SessionMaps,
  fn: () => Promise<T>
): Promise<T> {
  maps.quietDepth += 1;
  try {
    return await fn();
  } finally {
    maps.quietDepth -= 1;
    maps.snapshotEpoch += 1;
    notify(maps);
  }
}

/**
 * Mediated `close()` throws when the actor is crashed / partitioned. Teardown
 * (wipe, dispose, remove) must still release sync engines — clear `down` then
 * ignore network errors so clearing the playground cannot crash the console.
 */
async function closeLiveForTeardown(
  world: World,
  live: PlaygroundClientLive
): Promise<void> {
  try {
    world.faults.restart(live.address);
  } catch {
    // World already disposed.
  }
  try {
    await live.close();
  } catch {
    // already unreachable / disposed
  }
}

async function wipeClientSql(
  world: World,
  live: PlaygroundClientLive
): Promise<void> {
  const dbAddress = `${live.address}.db`;
  try {
    await world.faults.wipe(dbAddress);
  } catch {
    // Provider missing or world disposed.
  }
}

/** Drop the handle entirely (client removed from playground). */
async function destroyClientSql(
  world: World,
  clientSqlByAddress: Map<string, PlaygroundSqlHandle>,
  live: PlaygroundClientLive
): Promise<void> {
  const dbAddress = `${live.address}.db`;
  // Wipe resets in place (keeps handle identity for fault reuse). For remove we
  // still need to drop the handle from the session map.
  await wipeClientSql(world, live);
  const orphan = clientSqlByAddress.get(dbAddress);
  if (orphan !== undefined) {
    await orphan.disconnect();
    clientSqlByAddress.delete(dbAddress);
  }
}

async function disposeClientLive(
  world: World,
  clientSqlByAddress: Map<string, PlaygroundSqlHandle>,
  live: PlaygroundClientLive,
  mode: 'reset' | 'destroy'
): Promise<void> {
  await closeLiveForTeardown(world, live);
  try {
    world.faults.crash(live.address);
  } catch {
    // World already disposed.
  }
  clearClientDurablePorts(live.id);
  if (mode === 'destroy') {
    await destroyClientSql(world, clientSqlByAddress, live);
  } else {
    await wipeClientSql(world, live);
  }
}

export async function removeClient(
  world: World,
  maps: SessionMaps,
  clientSqlByAddress: Map<string, PlaygroundSqlHandle>,
  id: string
): Promise<void> {
  const live = maps.lives.get(id);
  if (live === undefined) return;
  // Drop from session maps + notify before closing SQL so ProductApp unmounts
  // (same order as wipeSession). During runQuiet, notify is deferred — use
  // detachClientsForSnapshotLoad for snapshot restore instead.
  maps.lives.delete(id);
  maps.clients.delete(id);
  notify(maps);
  await disposeClientLive(world, clientSqlByAddress, live, 'destroy');
}

/**
 * Snapshot restore: hide client UI, reset SQL handles in place, then caller
 * imports inside `runQuiet`. Reset (not destroy) keeps PlaygroundSqlHandle
 * identity so handle-bound clients / DB-pane polls never hit a closed AlaSQL
 * DB while React catches up to the empty-client notify.
 *
 * Must not run inside `runQuiet` — quiet would suppress the empty notify and
 * leave SyncEngineBoot migrating DBs mid-teardown (xcolumns crash).
 */
export async function detachClientsForSnapshotLoad(
  world: World,
  maps: SessionMaps,
  clientSqlByAddress: Map<string, PlaygroundSqlHandle>
): Promise<void> {
  const lives = [...maps.lives.values()];
  maps.snapshotRestoring = true;
  maps.lives.clear();
  maps.clients.clear();
  maps.snapshotEpoch += 1;
  notify(maps);
  for (const live of lives) {
    await disposeClientLive(world, clientSqlByAddress, live, 'reset');
  }
}

export function refreshRoomMap(
  roomNode: InProcessRoomNode,
  maps: SessionMaps,
  roomLogs: ReturnType<typeof createPlaygroundLogBuffer>
): void {
  const topics = roomNode.listTopics();
  let changed = false;
  for (const topic of topics) {
    if (!maps.rooms.has(topic)) {
      maps.rooms.set(topic, makePlaygroundRoomNode(topic, roomNode, roomLogs));
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

/**
 * Drop client actors from session maps and notify UI first so ProductApp
 * trees unmount before we tear down mediated lives / the World.
 */
function detachClientActors(maps: SessionMaps): PlaygroundClientLive[] {
  const lives = [...maps.lives.values()];
  maps.lives.clear();
  maps.clients.clear();
  notify(maps);
  return lives;
}

async function closeDetachedLives(
  world: World,
  lives: readonly PlaygroundClientLive[]
): Promise<void> {
  for (const live of lives) {
    await closeLiveForTeardown(world, live);
    clearClientDurablePorts(live.id);
  }
}

export async function wipeSession(
  args: SessionTeardownArgs,
  maps: SessionMaps,
  markDisposed: () => void
): Promise<void> {
  // Prevent concurrent dispose() from racing close on the same lives.
  markDisposed();
  const lives = detachClientActors(maps);
  await closeDetachedLives(args.world, lives);
  for (const handle of args.clientSqlByAddress.values()) {
    await handle.disconnect();
  }
  args.clientSqlByAddress.clear();
  await args.serverHandle.reset();
  args.roomNode.dispose();
  args.world.dispose();
  args.disposeTick();
  await args.serverHandle.disconnect();
  notify(maps);
}

export async function disposeSession(
  args: SessionTeardownArgs,
  maps: SessionMaps,
  unsubRooms: () => void,
  markDisposed: () => void
): Promise<void> {
  markDisposed();
  unsubRooms();
  const lives = detachClientActors(maps);
  await closeDetachedLives(args.world, lives);
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
