/**
 * Collect / apply checkpoint slices (SQL, rooms, faults, clock).
 */

import type { Client } from '@apps/client/product/create-client';
import type { RoomServerApp } from '@apps/room-server/app/create-room-server';
import type { SimClock } from '@pkgs/clock';
import type {
  SimCheckpoint,
  SimCheckpointRoomDump,
} from '@pkgs/sim-console/client';
import {
  dumpPlaygroundClientDurable,
  restorePlaygroundClientDurable,
} from '@sim/console/playground/playground-checkpoint-durable';
import { reconcileServerProfilesFromClients } from '@sim/console/playground/playground-snapshot-sync';
import { type Sim, simClientNamespace } from '@sim/console/sim/create-sim';
import {
  openFreshSimClientSql,
  type SimSqlHandle,
} from '@sim/console/sim/sim-sql';

export type CheckpointSessionMaps = {
  readonly clients: {
    readonly keys: () => IterableIterator<string>;
    readonly values: () => IterableIterator<{ readonly id: string }>;
    readonly size: number;
  };
  readonly lives: {
    readonly get: (id: string) => Client | undefined;
    readonly values: () => IterableIterator<Client>;
  };
};

export type CheckpointSessionCtx = {
  readonly sim: Sim;
  readonly clock: SimClock;
  readonly roomNode: RoomServerApp;
  readonly serverHandle: SimSqlHandle;
  readonly clientSqlByAddress: Map<string, SimSqlHandle>;
  readonly maps: CheckpointSessionMaps;
  readonly getClockPaused: () => boolean;
  readonly setClockPaused: (paused: boolean) => void;
  readonly spawnClient: (id?: string) => Promise<{ readonly id: string }>;
  readonly detachClientsForSnapshotLoad: () => Promise<void>;
  readonly notify: () => void;
  readonly endSnapshotRestoring: () => void;
  readonly runQuiet: <T>(fn: () => Promise<T>) => Promise<T>;
};

export function resetSimClock(clock: SimClock, ms: number): void {
  clock.reset(ms);
}

export function collectFaultFields(_ctx: CheckpointSessionCtx): {
  partitions: readonly string[];
  skewByAddress: Record<string, number>;
  downAddresses: string[];
  evictedAddresses: string[];
} {
  return {
    partitions: [],
    skewByAddress: {},
    downAddresses: [],
    evictedAddresses: [],
  };
}

export async function collectSqlAndKv(
  ctx: CheckpointSessionCtx,
  clientIds: readonly string[]
): Promise<{
  serverSql: Uint8Array;
  clientSql: Record<string, Uint8Array>;
  clientKv: Record<string, Record<string, string>>;
}> {
  const clientSql: Record<string, Uint8Array> = {};
  const clientKv: Record<string, Record<string, string>> = {};
  for (const clientId of clientIds) {
    const handle =
      ctx.clientSqlByAddress.get(clientId) ?? ctx.sim.clientSql(clientId);
    if (handle !== undefined) {
      clientSql[clientId] = await handle.exportBytes();
    }
    clientKv[clientId] = dumpPlaygroundClientDurable(
      simClientNamespace(clientId)
    );
  }
  return {
    serverSql: await ctx.serverHandle.exportBytes(),
    clientSql,
    clientKv,
  };
}

export function collectRooms(
  ctx: CheckpointSessionCtx,
  roomTopics: readonly string[]
): Record<string, SimCheckpointRoomDump> {
  const rooms: Record<string, SimCheckpointRoomDump> = {};
  for (const topic of roomTopics) {
    const exported = ctx.roomNode.exportTopic(topic);
    if (exported === null) continue;
    rooms[topic] = {
      entries: exported.entries,
      dedup: exported.dedup ?? {},
    };
  }
  return rooms;
}

async function ensureClientSqlHandle(
  ctx: CheckpointSessionCtx,
  clientId: string
): Promise<SimSqlHandle> {
  const existing =
    ctx.clientSqlByAddress.get(clientId) ?? ctx.sim.clientSql(clientId);
  if (existing !== undefined) return existing;
  await ctx.sim.client(clientId).openSqlClient();
  const handle = ctx.sim.clientSql(clientId);
  if (handle === undefined) {
    const opened = await openFreshSimClientSql(
      `sim_client_${clientId}`,
      ctx.clock
    );
    ctx.clientSqlByAddress.set(clientId, opened);
    return opened;
  }
  ctx.clientSqlByAddress.set(clientId, handle);
  return handle;
}

export async function importCheckpointSql(
  ctx: CheckpointSessionCtx,
  checkpoint: SimCheckpoint
): Promise<void> {
  await ctx.serverHandle.importBytes(checkpoint.serverSql);
  for (const id of checkpoint.clientIds) {
    const handle = await ensureClientSqlHandle(ctx, id);
    const bytes = checkpoint.clientSql[id];
    if (bytes !== undefined) await handle.importBytes(bytes);
  }
  await reconcileServerProfilesFromClients(ctx, checkpoint.clientIds);
  for (const id of checkpoint.clientIds) {
    await ctx.spawnClient(id);
  }
}

export function restoreCheckpointKv(checkpoint: SimCheckpoint): void {
  for (const id of checkpoint.clientIds) {
    const kv = checkpoint.clientKv[id];
    if (kv === undefined) continue;
    restorePlaygroundClientDurable(simClientNamespace(id), { ...kv });
  }
}

export async function restoreCheckpointRooms(
  ctx: CheckpointSessionCtx,
  checkpoint: SimCheckpoint
): Promise<void> {
  const keep = new Set(checkpoint.roomTopics);
  for (const topic of ctx.roomNode.listTopics()) {
    if (!keep.has(topic)) ctx.roomNode.dropTopic(topic);
  }
  for (const topic of checkpoint.roomTopics) {
    const room = checkpoint.rooms[topic];
    if (room === undefined) continue;
    await ctx.roomNode.replaceTopic(topic, {
      entries: room.entries as never,
      dedup: room.dedup as never,
    });
  }
}

export function applyCheckpointFaults(
  sim: Sim,
  checkpoint: SimCheckpoint
): void {
  sim.heal();
  for (const part of checkpoint.partitions) {
    const sep = part.indexOf('|');
    if (sep < 0) continue;
    const a = part.slice(0, sep);
    const b = part.slice(sep + 1);
    if (a.length > 0 && b.length > 0) sim.partition(a, b);
  }
  for (const addr of checkpoint.downAddresses) {
    const id = addr.startsWith('client:') ? addr.slice('client:'.length) : addr;
    sim.crash(id === 'server' || id === 'api' ? 'server' : id);
  }
}
