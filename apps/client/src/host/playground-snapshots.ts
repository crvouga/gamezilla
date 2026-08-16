/**
 * Full-runtime playground snapshot save / list / load via ObjectStore (MinIO).
 */

import type { InProcessRoomNode } from '@apps/client/host/in-process-room-node';
import type { PlaygroundClientLive } from '@apps/client/host/playground-impls';
import {
  clientDbName,
  clientNamespace,
  openPlaygroundSql,
  type PlaygroundSqlHandle,
} from '@apps/client/host/playground-provide';
import type { Io } from '@pkgs/io';
import {
  dumpNamespacedKvWeb,
  restoreNamespacedKvWeb,
} from '@pkgs/kv/impl-kv-web-namespaced';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { World } from '@pkgs/system';
import type {
  PlaygroundActor,
  PlaygroundSnapshotInfo,
  PlaygroundSnapshotManifest,
} from '@pkgs/system-console/client';

const MANIFEST_VERSION = 1 as const;
const INDEX_KEY = 'index.json';

export type SnapshotSessionMaps = {
  readonly clients: Map<string, PlaygroundActor>;
  readonly lives: Map<string, PlaygroundClientLive>;
  readonly listeners: Set<() => void>;
};

export type SnapshotSessionCtx = {
  readonly store: ObjectStore;
  readonly world: World;
  readonly io: Io;
  readonly roomNode: InProcessRoomNode;
  readonly serverHandle: PlaygroundSqlHandle;
  readonly clientSqlByAddress: Map<string, PlaygroundSqlHandle>;
  readonly maps: SnapshotSessionMaps;
  readonly getClockPaused: () => boolean;
  readonly setClockPaused: (paused: boolean) => void;
  readonly spawnClient: (id?: string) => Promise<PlaygroundActor>;
  readonly removeClient: (id: string) => Promise<void>;
  readonly notify: () => void;
  /** Suppress session UI notifies while `fn` runs; notify once afterward. */
  readonly runQuiet: <T>(fn: () => Promise<T>) => Promise<T>;
};

type SnapshotIndex = {
  readonly snapshots: readonly PlaygroundSnapshotInfo[];
};

async function readBody(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value !== undefined) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

async function putJson(
  store: ObjectStore,
  key: string,
  value: unknown
): Promise<void> {
  const text = JSON.stringify(value);
  await store.put(key, new TextEncoder().encode(text), 'application/json');
}

async function getJson<T>(store: ObjectStore, key: string): Promise<T | null> {
  const obj = await store.get(key);
  if (obj === null) return null;
  const text = new TextDecoder().decode(await readBody(obj.body));
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function readIndex(store: ObjectStore): Promise<SnapshotIndex> {
  return (await getJson<SnapshotIndex>(store, INDEX_KEY)) ?? { snapshots: [] };
}

function slugLabel(label: string | undefined, now: number): string {
  const base =
    label
      ?.trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'snap';
  return `${base}-${String(now)}`;
}

function collectAddresses(ctx: SnapshotSessionCtx): string[] {
  const addrs = ['api', 'events'];
  for (const c of ctx.maps.clients.values()) addrs.push(c.address);
  for (const topic of ctx.roomNode.listTopics()) addrs.push(`room:${topic}`);
  return addrs;
}

export async function listPlaygroundSnapshots(
  store: ObjectStore
): Promise<readonly PlaygroundSnapshotInfo[]> {
  const index = await readIndex(store);
  return index.snapshots;
}

export async function savePlaygroundSnapshot(
  ctx: SnapshotSessionCtx,
  label?: string
): Promise<PlaygroundSnapshotInfo> {
  const now = ctx.io.clock.now();
  const id = slugLabel(label, now);
  const prefix = `snapshots/${id}/`;
  const clientIds = [...ctx.maps.clients.keys()];
  const roomTopics = [...ctx.roomNode.listTopics()];
  const addresses = collectAddresses(ctx);
  const skewByAddress: Record<string, number> = {};
  const downAddresses: string[] = [];
  const evictedAddresses: string[] = [];
  for (const addr of addresses) {
    const skew = ctx.world.faults.getSkew(addr);
    if (skew !== 0) skewByAddress[addr] = skew;
    const inst = ctx.world.instances.get(addr);
    if (inst?.down === true) downAddresses.push(addr);
    if (inst?.evicted === true) evictedAddresses.push(addr);
  }

  await ctx.store.put(
    `${prefix}sql/server.bin`,
    await ctx.serverHandle.exportBytes(),
    'application/octet-stream'
  );

  const clientSqlKeys: Record<string, string> = {};
  for (const clientId of clientIds) {
    const handle = ctx.clientSqlByAddress.get(`client:${clientId}.db`);
    if (handle === undefined) continue;
    const key = `${prefix}sql/client_${clientId}.bin`;
    await ctx.store.put(
      key,
      await handle.exportBytes(),
      'application/octet-stream'
    );
    clientSqlKeys[clientId] = key;
  }

  for (const clientId of clientIds) {
    await putJson(
      ctx.store,
      `${prefix}kv/client_${clientId}.json`,
      dumpNamespacedKvWeb(clientNamespace(clientId))
    );
  }

  for (const topic of roomTopics) {
    const exported = ctx.roomNode.exportTopic(topic);
    if (exported === null) continue;
    await putJson(
      ctx.store,
      `${prefix}rooms/${encodeURIComponent(topic)}.json`,
      { entries: exported.entries, dedup: exported.dedup ?? {} }
    );
  }

  const manifest: PlaygroundSnapshotManifest = {
    version: MANIFEST_VERSION,
    id,
    label: label?.trim() || id,
    createdAtMs: now,
    clockMs: ctx.io.clock.now(),
    clockPaused: ctx.getClockPaused(),
    clientIds,
    roomTopics,
    partitions: [...ctx.world.partitions],
    skewByAddress,
    downAddresses,
    evictedAddresses,
    keys: {
      serverSql: `${prefix}sql/server.bin`,
      clientSql: clientSqlKeys,
    },
  };
  await putJson(ctx.store, `${prefix}manifest.json`, manifest);

  const info: PlaygroundSnapshotInfo = {
    id,
    label: manifest.label,
    createdAtMs: now,
  };
  const index = await readIndex(ctx.store);
  await putJson(ctx.store, INDEX_KEY, {
    snapshots: [info, ...index.snapshots.filter((s) => s.id !== id)],
  });
  return info;
}

async function restoreClientKv(
  store: ObjectStore,
  prefix: string,
  clientIds: readonly string[]
): Promise<void> {
  for (const id of clientIds) {
    const kv = await getJson<Record<string, string>>(
      store,
      `${prefix}kv/client_${id}.json`
    );
    if (kv !== null) restoreNamespacedKvWeb(clientNamespace(id), kv);
  }
}

async function ensureClientSqlHandle(
  ctx: SnapshotSessionCtx,
  clientId: string
): Promise<PlaygroundSqlHandle> {
  const address = `client:${clientId}.db`;
  const existing = ctx.clientSqlByAddress.get(address);
  if (existing !== undefined) return existing;
  const handle = await openPlaygroundSql(clientDbName(clientId), ctx.io.timers);
  ctx.clientSqlByAddress.set(address, handle);
  return handle;
}

/**
 * Import OPFS bytes *before* spawn so ProductApp migrate cannot race
 * importBytes on the same DB (expo-sqlite "Error finalizing statement").
 */
async function restoreClientSql(
  ctx: SnapshotSessionCtx,
  manifest: PlaygroundSnapshotManifest
): Promise<void> {
  for (const id of manifest.clientIds) {
    const handle = await ensureClientSqlHandle(ctx, id);
    const key = manifest.keys.clientSql[id];
    if (key !== undefined) {
      const obj = await ctx.store.get(key);
      if (obj !== null) {
        await handle.importBytes(await readBody(obj.body));
      }
    }
    await ctx.spawnClient(id);
  }
}

async function restoreRooms(
  ctx: SnapshotSessionCtx,
  prefix: string,
  roomTopics: readonly string[]
): Promise<void> {
  for (const topic of roomTopics) {
    const room = await getJson<{
      entries: readonly unknown[];
      dedup: Record<string, unknown>;
    }>(ctx.store, `${prefix}rooms/${encodeURIComponent(topic)}.json`);
    if (room === null) continue;
    await ctx.roomNode.replaceTopic(topic, {
      entries: room.entries as never,
      dedup: (room.dedup ?? {}) as never,
    });
  }
}

function applyFaultState(
  world: World,
  manifest: PlaygroundSnapshotManifest
): void {
  world.faults.heal();
  world.faults.clearSkew();
  for (const part of manifest.partitions) {
    const sep = part.indexOf('|');
    if (sep < 0) continue;
    const a = part.slice(0, sep);
    const b = part.slice(sep + 1);
    if (a.length > 0 && b.length > 0) world.faults.partition(a, b);
  }
  for (const [addr, ms] of Object.entries(manifest.skewByAddress)) {
    world.faults.skewClock(addr, ms);
  }
  for (const addr of manifest.downAddresses) world.faults.crash(addr);
  for (const addr of manifest.evictedAddresses) world.faults.evict(addr);
}

export async function loadPlaygroundSnapshot(
  ctx: SnapshotSessionCtx,
  snapshotId: string
): Promise<void> {
  const prefix = `snapshots/${snapshotId}/`;
  const manifest = await getJson<PlaygroundSnapshotManifest>(
    ctx.store,
    `${prefix}manifest.json`
  );
  if (manifest === null) {
    throw new Error(`snapshot '${snapshotId}' not found`);
  }

  ctx.setClockPaused(true);
  // Unmount ProductApps before touching OPFS (notify from removeClient).
  for (const id of [...ctx.maps.clients.keys()]) {
    await ctx.removeClient(id);
  }

  await ctx.runQuiet(async () => {
    const serverObj = await ctx.store.get(manifest.keys.serverSql);
    if (serverObj === null) throw new Error('missing server sql blob');
    await ctx.serverHandle.importBytes(await readBody(serverObj.body));

    await restoreClientKv(ctx.store, prefix, manifest.clientIds);
    await restoreClientSql(ctx, manifest);
    await restoreRooms(ctx, prefix, manifest.roomTopics);
    applyFaultState(ctx.world, manifest);
    ctx.setClockPaused(manifest.clockPaused);
  });
}
