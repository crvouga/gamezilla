/**
 * Session map notify / quiet batching + client teardown for product-simulator.
 */

import type { Client } from '@apps/client/shell/create-client';
import { makeProductSimulatorRoomNode } from '@apps/product/product-simulator/product-simulator-session-nodes';
import type { Sim } from '@apps/product/sim/fabric/create-sim';
import type { SimSql } from '@apps/product/sim/fabric/sim-sql';
import type { RoomServerApp } from '@apps/room-server/app/create-room-server';
import type {
  createProductSimulatorLogBuffer,
  ProductSimulatorActor,
  ProductSimulatorLogBuffer,
  ProductSimulatorRoomNode,
  ProductSimulatorSqlNode,
} from '@pkgs/sim-console/client';

export type SessionTeardownArgs = {
  readonly sim: Sim;
  readonly disposeTick: () => void;
};

export type SessionMaps = {
  readonly clients: Map<string, ProductSimulatorActor>;
  readonly lives: Map<string, Client>;
  /** API instances behind the balancer, in rotation order. */
  readonly servers: Map<string, ProductSimulatorSqlNode>;
  /** Per-instance request logs, kept across respawns of the same id. */
  readonly serverLogs: Map<string, ProductSimulatorLogBuffer>;
  readonly rooms: Map<string, ProductSimulatorRoomNode>;
  readonly listeners: Set<() => void>;
  revision: number;
  snapshotEpoch: number;
  snapshotRestoring: boolean;
  quietDepth: number;
  readonly domainWakeListeners: Set<(label: string) => void>;
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

export function fireDomainWake(maps: SessionMaps, label: string): void {
  if (maps.snapshotRestoring || maps.quietDepth > 0) return;
  for (const listener of [...maps.domainWakeListeners]) {
    try {
      listener(label);
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

async function closeLive(sim: Sim, id: string, live: Client): Promise<void> {
  try {
    sim.restart(id);
  } catch {
    // already disposed
  }
  try {
    await live.close();
  } catch {
    // already unreachable
  }
}

export async function removeClient(
  sim: Sim,
  maps: SessionMaps,
  id: string
): Promise<void> {
  const live = maps.lives.get(id);
  if (live === undefined) return;
  maps.lives.delete(id);
  maps.clients.delete(id);
  notify(maps);
  fireDomainWake(maps, 'remove');
  await closeLive(sim, id, live);
  await sim.dropClient(id);
}

export async function detachClientsForSnapshotLoad(
  sim: Sim,
  maps: SessionMaps
): Promise<void> {
  const lives = [...maps.lives.entries()];
  maps.snapshotRestoring = true;
  maps.lives.clear();
  maps.clients.clear();
  maps.snapshotEpoch += 1;
  notify(maps);
  for (const [id, live] of lives) {
    await closeLive(sim, id, live);
    await sim.dropClient(id);
  }
}

export function refreshRoomMap(
  roomNode: RoomServerApp,
  maps: SessionMaps,
  roomLogs: ReturnType<typeof createProductSimulatorLogBuffer>
): void {
  const topics = roomNode.listTopics();
  let changed = false;
  for (const topic of topics) {
    if (!maps.rooms.has(topic)) {
      maps.rooms.set(
        topic,
        makeProductSimulatorRoomNode(topic, roomNode, roomLogs)
      );
      changed = true;
    }
  }
  for (const topic of [...maps.rooms.keys()]) {
    if (!topics.includes(topic)) {
      maps.rooms.delete(topic);
      changed = true;
    }
  }
  if (changed) {
    notify(maps);
    fireDomainWake(maps, 'room');
  }
}

function detachClientActors(
  maps: SessionMaps
): readonly { id: string; live: Client }[] {
  const lives = [...maps.lives.entries()].map(([id, live]) => ({ id, live }));
  maps.lives.clear();
  maps.clients.clear();
  notify(maps);
  return lives;
}

export async function wipeSession(
  args: SessionTeardownArgs,
  maps: SessionMaps,
  markDisposed: () => void
): Promise<void> {
  markDisposed();
  const lives = detachClientActors(maps);
  for (const row of lives) {
    await closeLive(args.sim, row.id, row.live);
  }
  args.disposeTick();
  await args.sim.dispose();
  await args.sim.session.dispose();
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
  for (const row of lives) {
    await closeLive(args.sim, row.id, row.live);
  }
  args.disposeTick();
  await args.sim.dispose();
  await args.sim.session.dispose();
  maps.listeners.clear();
}

export function sqlHandleForClient(sim: Sim, id: string): SimSql | undefined {
  return sim.clientSql(id);
}
