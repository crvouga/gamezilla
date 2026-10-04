/**
 * Session map notify / quiet batching + client teardown for product-harness.
 */

import { makeProductHarnessRoomNode } from './product-harness-session-nodes';
import type { Client } from '@libs/app-client/create-client';
import type { HarnessRoomNode } from '@libs/harness/composition';
import type { Harness } from '@libs/harness/create-harness';
import type { HarnessSql } from '@libs/harness/sql-types';
import type { createProductHarnessLogBuffer } from '@pkgs/harness-console-shared/product-harness-log-buffer';
import type { ProductHarnessActor, ProductHarnessLogBuffer, ProductHarnessRoomNode, ProductHarnessSqlNode } from '@pkgs/harness-console-shared/ports';

export type SessionTeardownArgs = {
  readonly harness: Harness;
  readonly disposeTick: () => void;
};

export type SessionMaps = {
  readonly clients: Map<string, ProductHarnessActor>;
  readonly lives: Map<string, Client>;
  /** API instances behind the balancer, in rotation order. */
  readonly servers: Map<string, ProductHarnessSqlNode>;
  /** Per-instance request logs, kept across respawns of the same id. */
  readonly serverLogs: Map<string, ProductHarnessLogBuffer>;
  readonly rooms: Map<string, ProductHarnessRoomNode>;
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

async function closeLive(
  harness: Harness,
  id: string,
  live: Client
): Promise<void> {
  try {
    harness.restart(id);
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
  harness: Harness,
  maps: SessionMaps,
  id: string
): Promise<void> {
  const live = maps.lives.get(id);
  if (live === undefined) return;
  maps.lives.delete(id);
  maps.clients.delete(id);
  notify(maps);
  fireDomainWake(maps, 'remove');
  await closeLive(harness, id, live);
  await harness.dropClient(id);
}

export async function detachClientsForSnapshotLoad(
  harness: Harness,
  maps: SessionMaps
): Promise<void> {
  const lives = [...maps.lives.entries()];
  maps.snapshotRestoring = true;
  maps.lives.clear();
  maps.clients.clear();
  maps.snapshotEpoch += 1;
  notify(maps);
  for (const [id, live] of lives) {
    await closeLive(harness, id, live);
    await harness.dropClient(id);
  }
}

export function refreshRoomMap(
  roomNode: HarnessRoomNode,
  maps: SessionMaps,
  roomLogs: ReturnType<typeof createProductHarnessLogBuffer>
): void {
  const topics = roomNode.listTopics();
  let changed = false;
  for (const topic of topics) {
    if (!maps.rooms.has(topic)) {
      maps.rooms.set(
        topic,
        makeProductHarnessRoomNode(topic, roomNode, roomLogs)
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
    await closeLive(args.harness, row.id, row.live);
  }
  args.disposeTick();
  await args.harness.dispose();
  await args.harness.session.dispose();
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
    await closeLive(args.harness, row.id, row.live);
  }
  args.disposeTick();
  await args.harness.dispose();
  await args.harness.session.dispose();
  maps.listeners.clear();
}

export function sqlHandleForClient(
  harness: Harness,
  id: string
): HarnessSql | undefined {
  return harness.clientSql(id);
}
