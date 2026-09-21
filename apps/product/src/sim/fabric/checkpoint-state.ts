/**
 * Collect / apply checkpoint slices (SQL, rooms, faults, clock).
 */

import type { Client } from '@libs/client-app/shell/create-client';
import type { RoomServerApp } from '@libs/room-app/app/create-room-server';
import { migrateSimClientSqlite } from '@libs/runtime/root/sim/migrate-sim-sqlite';
import { assert } from '@pkgs/assert';
import type { Clock } from '@pkgs/clock';
import type { Session } from '@pkgs/sim';
import type {
  SimCheckpoint,
  SimCheckpointRoomDump,
} from '@pkgs/sim-console/client';
import {
  dumpProductSimulatorClientDurable,
  restoreProductSimulatorClientDurable,
} from './client-durable';
import type { Sim } from './create-sim';
import { simClientNamespace } from './sim-client-namespace';
import { SIM_PRIMARY_SERVER_ID } from './sim-server-nodes';
import { openFreshSimClientSql, type SimSql } from './sim-sql';
import { reconcileServerProfilesFromClients } from './snapshot-sync';

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

type UnderlyingScheduler = Session['scheduler']['underlying'];

export type CheckpointSessionCtx = {
  readonly sim: Sim;
  readonly clock: Clock;
  readonly scheduler: UnderlyingScheduler;
  readonly roomNode: RoomServerApp;
  readonly serverHandle: SimSql;
  readonly clientSqlByAddress: Map<string, SimSql>;
  readonly maps: CheckpointSessionMaps;
  readonly getClockPaused: () => boolean;
  readonly setClockPaused: (paused: boolean) => void;
  readonly spawnClient: (id?: string) => Promise<{ readonly id: string }>;
  /** Rebuild console-side server nodes after the fleet is resized. */
  readonly refreshServers: () => void;
  readonly detachClientsForSnapshotLoad: () => Promise<void>;
  readonly notify: () => void;
  readonly endSnapshotRestoring: () => void;
  readonly runQuiet: <T>(fn: () => Promise<T>) => Promise<T>;
};

export function resetSimClock(
  scheduler: UnderlyingScheduler,
  ms: number
): void {
  scheduler.reset(ms);
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
    clientKv[clientId] = dumpProductSimulatorClientDurable(
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
): Promise<SimSql> {
  const existing =
    ctx.clientSqlByAddress.get(clientId) ?? ctx.sim.clientSql(clientId);
  if (existing !== undefined) return existing;
  await (await ctx.sim.client(clientId)).openSqlClient();
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
  // Sticky / saved snaps may predate schema (e.g. idp_*). Remigrate accretes
  // missing tables without wiping restored data.
  const pool = ctx.serverHandle.pool;
  assert.defined(
    pool,
    'importCheckpointSql: server handle requires pool for remigrate'
  );
  // Lazy: Postgres migration runs against the node pool — never in the web
  // bundle.
  const { migrateSimPostgres } = await import(
    '@libs/runtime/root/sim/migrate-sim-postgres'
  );
  await migrateSimPostgres({
    sqlClient: ctx.serverHandle.sqlClient,
    pool,
    now: () => ctx.clock.now(),
  });
  for (const id of checkpoint.clientIds) {
    const handle = await ensureClientSqlHandle(ctx, id);
    const bytes = checkpoint.clientSql[id];
    if (bytes !== undefined) await handle.importBytes(bytes);
    await migrateSimClientSqlite({
      sqlClient: handle.sqlClient,
      now: () => ctx.clock.now(),
    });
  }
  await reconcileServerProfilesFromClients(ctx, checkpoint.clientIds);
  for (const id of checkpoint.clientIds) {
    await ctx.spawnClient(id);
  }
}

/**
 * Resize the API fleet back to the captured shape. An empty list means the
 * capture predates dynamic fleets, so fall back to a single instance.
 */
export async function restoreCheckpointServers(
  ctx: CheckpointSessionCtx,
  checkpoint: SimCheckpoint
): Promise<void> {
  const want =
    checkpoint.serverIds.length > 0
      ? checkpoint.serverIds
      : [SIM_PRIMARY_SERVER_ID];
  for (const id of ctx.sim.serverIds()) {
    if (!want.includes(id)) await ctx.sim.dropServer(id);
  }
  for (const id of want) await ctx.sim.spawnServer(id);
  ctx.refreshServers();
}

export function restoreCheckpointKv(checkpoint: SimCheckpoint): void {
  for (const id of checkpoint.clientIds) {
    const kv = checkpoint.clientKv[id];
    if (kv === undefined) continue;
    restoreProductSimulatorClientDurable(simClientNamespace(id), { ...kv });
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
    sim.crash(id === 'server' || id === 'api' ? SIM_PRIMARY_SERVER_ID : id);
  }
}
