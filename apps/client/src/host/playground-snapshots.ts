/**
 * Full-runtime playground snapshot save / list / load via ObjectStore (MinIO).
 */

import type { InProcessRoomNode } from '@apps/client/host/in-process-room-node';
import type { PlaygroundClientLive } from '@apps/client/host/playground-impls';
import {
  bumpPlaygroundDurableEpoch,
  clientDbName,
  clientNamespace,
  openFreshPlaygroundSql,
  type PlaygroundSqlHandle,
} from '@apps/client/host/playground-provide';
import {
  deleteSnapshotTree,
  INDEX_KEY,
  pruneInvalidPlaygroundSnapshots,
  putJson,
  readBody,
  readIndex,
  readText,
} from '@apps/client/host/playground-snapshot-prune';
import {
  parseJsonBytesWithSchema,
  parseJsonWithSchema,
  playgroundAlaSqlDumpSchema,
  playgroundClientKvDumpSchema,
  playgroundSnapshotManifestSchema,
} from '@apps/client/host/playground-snapshot-schema';
import {
  awaitPlaygroundMutationDrain,
  reconcileServerProfilesFromClients,
} from '@apps/client/host/playground-snapshot-sync';
import { clearNamespacedAuthClientStorage } from '@pkgs/auth-better-auth/client';
import type { Io } from '@pkgs/io';
import {
  clearNamespacedKvWeb,
  dumpNamespacedKvWeb,
} from '@pkgs/kv/impl-kv-web-namespaced';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { clearNamespacedWebSecureStorage } from '@pkgs/secure-storage/impl-web';
import type { World } from '@pkgs/system';
import type {
  PlaygroundActor,
  PlaygroundSnapshotInfo,
  PlaygroundSnapshotManifest,
} from '@pkgs/system-console/client';

/** Mirrors `@pkgs/secure-storage` session-scoped keys (tab-local). */
const SESSION_SCOPED_DURABLE_KEYS = new Set(['lastLocalAccountId']);

function dumpStoragePrefix(
  storage: Storage | undefined,
  namespace: string
): Record<string, string> {
  if (storage === undefined) return {};
  const prefix = `${namespace}.`;
  const out: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === null || !key.startsWith(prefix)) continue;
    const value = storage.getItem(key);
    if (value !== null) out[key.slice(prefix.length)] = value;
  }
  return out;
}

/** Auth + secure + kv under `namespace.` (localStorage + sessionStorage). */
function dumpPlaygroundClientDurable(
  namespace: string
): Record<string, string> {
  return {
    ...dumpNamespacedKvWeb(namespace),
    ...dumpStoragePrefix(globalThis.sessionStorage, namespace),
  };
}

function restorePlaygroundClientDurable(
  namespace: string,
  entries: Record<string, string>
): void {
  clearNamespacedKvWeb(namespace);
  clearNamespacedAuthClientStorage(namespace);
  clearNamespacedWebSecureStorage(namespace);
  const ls = globalThis.localStorage;
  const ss = globalThis.sessionStorage;
  for (const [rel, value] of Object.entries(entries)) {
    if (SESSION_SCOPED_DURABLE_KEYS.has(rel)) {
      ss?.setItem(`${namespace}.${rel}`, value);
    } else {
      ls?.setItem(`${namespace}.${rel}`, value);
    }
  }
}

const MANIFEST_VERSION = 1 as const;

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
  /**
   * Unmount ProductApps (notify) then close/wipe client SQL. Must run outside
   * {@link runQuiet} so the detach notify is not suppressed.
   */
  readonly detachClientsForSnapshotLoad: () => Promise<void>;
  readonly notify: () => void;
  /** Mark snapshot restore finished so client ProductApps may mount again. */
  readonly endSnapshotRestoring: () => void;
  /** Suppress session UI notifies while `fn` runs; notify once afterward. */
  readonly runQuiet: <T>(fn: () => Promise<T>) => Promise<T>;
};

function slugLabel(label: string | undefined, now: number): string {
  const base =
    label
      ?.trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'snap';
  return `${base}-${String(now)}`;
}

/** Fixed UTC stamp from injected clock ms for default snapshot labels. */
function formatSnapshotStamp(ms: number): string {
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function defaultSnapshotLabel(now: number): string {
  return `Snapshot ${formatSnapshotStamp(now)}`;
}

function collectAddresses(ctx: SnapshotSessionCtx): string[] {
  const addrs = ['api', 'events'];
  for (const c of ctx.maps.clients.values()) addrs.push(c.address);
  for (const topic of ctx.roomNode.listTopics()) addrs.push(`room:${topic}`);
  return addrs;
}

function collectFaultFields(ctx: SnapshotSessionCtx): {
  skewByAddress: Record<string, number>;
  downAddresses: string[];
  evictedAddresses: string[];
} {
  const skewByAddress: Record<string, number> = {};
  const downAddresses: string[] = [];
  const evictedAddresses: string[] = [];
  for (const addr of collectAddresses(ctx)) {
    const skew = ctx.world.faults.getSkew(addr);
    if (skew !== 0) skewByAddress[addr] = skew;
    const inst = ctx.world.instances.get(addr);
    if (inst?.down === true) downAddresses.push(addr);
    if (inst?.evicted === true) evictedAddresses.push(addr);
  }
  return { skewByAddress, downAddresses, evictedAddresses };
}

async function putSqlBlobs(
  ctx: SnapshotSessionCtx,
  prefix: string,
  clientIds: readonly string[]
): Promise<{ serverSql: string; clientSql: Record<string, string> }> {
  const serverSql = `${prefix}sql/server.bin`;
  await ctx.store.put(
    serverSql,
    await ctx.serverHandle.exportBytes(),
    'application/json'
  );
  const clientSql: Record<string, string> = {};
  for (const clientId of clientIds) {
    const handle = ctx.clientSqlByAddress.get(`client:${clientId}.db`);
    if (handle === undefined) continue;
    const key = `${prefix}sql/client_${clientId}.bin`;
    await ctx.store.put(key, await handle.exportBytes(), 'application/json');
    clientSql[clientId] = key;
  }
  return { serverSql, clientSql };
}

async function putKvAndRooms(
  ctx: SnapshotSessionCtx,
  prefix: string,
  clientIds: readonly string[],
  roomTopics: readonly string[]
): Promise<void> {
  for (const clientId of clientIds) {
    await putJson(
      ctx.store,
      `${prefix}kv/client_${clientId}.json`,
      dumpPlaygroundClientDurable(clientNamespace(clientId))
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
}

export async function listPlaygroundSnapshots(
  store: ObjectStore
): Promise<readonly PlaygroundSnapshotInfo[]> {
  return pruneInvalidPlaygroundSnapshots(store);
}

/** Delete snapshot object tree and drop it from the index. */
export async function deletePlaygroundSnapshot(
  store: ObjectStore,
  snapshotId: string
): Promise<void> {
  const id = snapshotId.trim();
  if (id.length === 0) throw new Error('snapshot id required');
  await deleteSnapshotTree(store, id);
  const index = await readIndex(store);
  await putJson(store, INDEX_KEY, {
    snapshots: index.snapshots.filter((s) => s.id !== id),
  });
}

export async function savePlaygroundSnapshot(
  ctx: SnapshotSessionCtx,
  label?: string
): Promise<PlaygroundSnapshotInfo> {
  const now = ctx.io.clock.now();
  const displayLabel = label?.trim() || defaultSnapshotLabel(now);
  const id = slugLabel(label, now);
  const prefix = `snapshots/${id}/`;
  const clientIds = [...ctx.maps.clients.keys()];
  const roomTopics = [...ctx.roomNode.listTopics()];
  const faults = collectFaultFields(ctx);
  await awaitPlaygroundMutationDrain(ctx, clientIds);
  const keys = await putSqlBlobs(ctx, prefix, clientIds);
  await putKvAndRooms(ctx, prefix, clientIds, roomTopics);

  const manifest: PlaygroundSnapshotManifest = {
    version: MANIFEST_VERSION,
    id,
    label: displayLabel,
    createdAtMs: now,
    clockMs: ctx.io.clock.now(),
    clockPaused: ctx.getClockPaused(),
    clientIds,
    roomTopics,
    partitions: [...ctx.world.partitions],
    ...faults,
    keys,
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
    const text = await readText(store, `${prefix}kv/client_${id}.json`);
    if (text === null) continue;
    const kv = parseJsonWithSchema(text, playgroundClientKvDumpSchema);
    if (kv !== null) restorePlaygroundClientDurable(clientNamespace(id), kv);
  }
}

async function ensureClientSqlHandle(
  ctx: SnapshotSessionCtx,
  clientId: string
): Promise<PlaygroundSqlHandle> {
  const address = `client:${clientId}.db`;
  const existing = ctx.clientSqlByAddress.get(address);
  if (existing !== undefined) return existing;
  const handle = await openFreshPlaygroundSql(
    clientDbName(clientId),
    ctx.io.timers
  );
  ctx.clientSqlByAddress.set(address, handle);
  return handle;
}

async function importAlaSqlBlob(
  store: ObjectStore,
  key: string,
  handle: PlaygroundSqlHandle
): Promise<void> {
  const obj = await store.get(key);
  if (obj === null) throw new Error(`missing sql blob '${key}'`);
  const bytes = await readBody(obj.body);
  if (parseJsonBytesWithSchema(bytes, playgroundAlaSqlDumpSchema) === null) {
    throw new Error(`invalid AlaSQL snapshot blob '${key}'`);
  }
  await handle.importBytes(bytes);
}

/**
 * Import snapshot bytes *before* spawn so ProductApp migrate cannot race
 * import on the same DB.
 */
async function restoreClientSql(
  ctx: SnapshotSessionCtx,
  manifest: PlaygroundSnapshotManifest
): Promise<void> {
  for (const id of manifest.clientIds) {
    const handle = await ensureClientSqlHandle(ctx, id);
    const key = manifest.keys.clientSql[id];
    if (key !== undefined) {
      await importAlaSqlBlob(ctx.store, key, handle);
    }
  }
  await reconcileServerProfilesFromClients(ctx, manifest.clientIds);
  for (const id of manifest.clientIds) {
    await ctx.spawnClient(id);
  }
}

async function restoreRooms(
  ctx: SnapshotSessionCtx,
  prefix: string,
  roomTopics: readonly string[]
): Promise<void> {
  for (const topic of roomTopics) {
    const text = await readText(
      ctx.store,
      `${prefix}rooms/${encodeURIComponent(topic)}.json`
    );
    if (text === null) continue;
    let room: { entries?: unknown; dedup?: unknown };
    try {
      room = JSON.parse(text) as typeof room;
    } catch {
      continue;
    }
    await ctx.roomNode.replaceTopic(topic, {
      entries: (room.entries ?? []) as never,
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
  const text = await readText(ctx.store, `${prefix}manifest.json`);
  if (text === null) {
    throw new Error(`snapshot '${snapshotId}' not found`);
  }
  const manifest = parseJsonWithSchema(text, playgroundSnapshotManifestSchema);
  if (manifest === null) {
    throw new Error(`snapshot '${snapshotId}' has an invalid manifest`);
  }

  // Hide ProductApps, destroy SQL, then restore. Painting clients during
  // teardown lets SyncEngineBoot migrate a DB mid-destroy (xcolumns crash).
  ctx.setClockPaused(true);
  try {
    await ctx.detachClientsForSnapshotLoad();
    await ctx.runQuiet(async () => {
      // New durable epoch before restore so unmounting AuthBridge writes land in
      // the abandoned prior namespace.
      bumpPlaygroundDurableEpoch();
      await importAlaSqlBlob(
        ctx.store,
        manifest.keys.serverSql,
        ctx.serverHandle
      );
      await restoreClientKv(ctx.store, prefix, manifest.clientIds);
      await restoreClientSql(ctx, manifest);
      await restoreRooms(ctx, prefix, manifest.roomTopics);
      applyFaultState(ctx.world, manifest);
      ctx.setClockPaused(manifest.clockPaused);
      // Clear before runQuiet's exit notify so ProductApps may mount.
      ctx.endSnapshotRestoring();
    });
  } catch (err) {
    ctx.endSnapshotRestoring();
    ctx.notify();
    throw err;
  }
}
