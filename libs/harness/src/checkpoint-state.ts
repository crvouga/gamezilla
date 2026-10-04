/**
 * Collect / apply checkpoint slices (SQL, rooms, faults, clock).
 */

import type { Client } from '@libs/app-client/create-client';
import { assert } from '@pkgs/assert-shared/singleton';
import type { Clock } from '@pkgs/clock-shared/types';
import type {
  HarnessCheckpoint,
  HarnessCheckpointRoomDump,
} from '@pkgs/harness-console-shared/checkpoint';
import type { Session } from '@pkgs/harness-shared/runtime-types';
import {
  dumpProductHarnessClientDurable,
  restoreProductHarnessClientDurable,
} from './client-durable';
import type { Harness } from './create-harness';
import {
  compositionMigratePostgres,
  migrateCompositionClientSqlite,
} from './migrate-composition';
import { HARNESS_PRIMARY_SERVER_ID } from './server-nodes';
import { reconcileServerProfilesFromClients } from './snapshot-sync';
import { openFreshHarnessClientSql } from './sql';
import type { HarnessSql } from './sql-types';

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
  readonly harness: Harness;
  readonly clock: Clock;
  readonly scheduler: UnderlyingScheduler;
  readonly serverHandle: HarnessSql;
  readonly clientSqlByAddress: Map<string, HarnessSql>;
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

export function resetHarnessClock(
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
      ctx.clientSqlByAddress.get(clientId) ?? ctx.harness.clientSql(clientId);
    if (handle !== undefined) {
      clientSql[clientId] = await handle.exportBytes();
    }
    clientKv[clientId] = dumpProductHarnessClientDurable(
      ctx.harness.clientNamespace(clientId)
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
): Record<string, HarnessCheckpointRoomDump> {
  const rooms: Record<string, HarnessCheckpointRoomDump> = {};
  for (const topic of roomTopics) {
    const exported = ctx.harness.roomNode.exportTopic(topic);
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
): Promise<HarnessSql> {
  const existing =
    ctx.clientSqlByAddress.get(clientId) ?? ctx.harness.clientSql(clientId);
  if (existing !== undefined) return existing;
  await (await ctx.harness.client(clientId)).openSqlClient();
  const handle = ctx.harness.clientSql(clientId);
  if (handle === undefined) {
    const opened = await openFreshHarnessClientSql(
      `harness_client_${clientId}`,
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
  checkpoint: HarnessCheckpoint
): Promise<void> {
  await ctx.serverHandle.importBytes(checkpoint.serverSql);
  // Sticky / saved snaps may predate schema (e.g. idp_*). Remigrate accretes
  // missing tables without wiping restored data.
  const pool = ctx.serverHandle.pool;
  assert.defined(
    pool,
    'importCheckpointSql: server handle requires pool for remigrate'
  );
  await compositionMigratePostgres(ctx.harness.composition)({
    sqlClient: ctx.serverHandle.sqlClient,
    pool,
    now: () => ctx.clock.now(),
  });
  for (const id of checkpoint.clientIds) {
    const handle = await ensureClientSqlHandle(ctx, id);
    const bytes = checkpoint.clientSql[id];
    if (bytes !== undefined) await handle.importBytes(bytes);
    await migrateCompositionClientSqlite(ctx.harness.composition.app, {
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
  checkpoint: HarnessCheckpoint
): Promise<void> {
  const want =
    checkpoint.serverIds.length > 0
      ? checkpoint.serverIds
      : [HARNESS_PRIMARY_SERVER_ID];
  for (const id of ctx.harness.serverIds()) {
    if (!want.includes(id)) await ctx.harness.dropServer(id);
  }
  for (const id of want) await ctx.harness.spawnServer(id);
  ctx.refreshServers();
}

export function restoreCheckpointKv(
  ctx: CheckpointSessionCtx,
  checkpoint: HarnessCheckpoint
): void {
  for (const id of checkpoint.clientIds) {
    const kv = checkpoint.clientKv[id];
    if (kv === undefined) continue;
    restoreProductHarnessClientDurable(ctx.harness.clientNamespace(id), {
      ...kv,
    });
  }
}

export async function restoreCheckpointRooms(
  ctx: CheckpointSessionCtx,
  checkpoint: HarnessCheckpoint
): Promise<void> {
  const keep = new Set(checkpoint.roomTopics);
  for (const topic of ctx.harness.roomNode.listTopics()) {
    if (!keep.has(topic)) ctx.harness.roomNode.dropTopic(topic);
  }
  for (const topic of checkpoint.roomTopics) {
    const room = checkpoint.rooms[topic];
    if (room === undefined) continue;
    await ctx.harness.roomNode.replaceTopic(topic, {
      entries: room.entries as never,
      dedup: room.dedup as never,
    });
  }
}

export function applyCheckpointFaults(
  harness: Harness,
  checkpoint: HarnessCheckpoint
): void {
  harness.heal();
  for (const part of checkpoint.partitions) {
    const sep = part.indexOf('|');
    if (sep < 0) continue;
    const a = part.slice(0, sep);
    const b = part.slice(sep + 1);
    if (a.length > 0 && b.length > 0) harness.partition(a, b);
  }
  for (const addr of checkpoint.downAddresses) {
    const id = addr.startsWith('client:') ? addr.slice('client:'.length) : addr;
    harness.crash(
      id === 'server' || id === 'api' ? HARNESS_PRIMARY_SERVER_ID : id
    );
  }
}
