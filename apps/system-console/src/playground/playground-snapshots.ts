/**
 * Full-runtime playground snapshot save / list / load via ObjectStore
 * (HTTP → Bun local report server → S3/B2 under playground-snapshots/).
 */

import {
  type CheckpointSessionCtx,
  captureCheckpoint,
  restoreCheckpoint,
} from '@apps/system-console/playground/playground-checkpoint';
import {
  deleteSnapshotTree,
  INDEX_KEY,
  pruneInvalidPlaygroundSnapshots,
  purgeIncompatiblePlaygroundSnapshots,
  putJson,
  readBody,
  readIndex,
  readText,
  snapshotCompatibility,
  toSnapshotInfo,
} from '@apps/system-console/playground/playground-snapshot-prune';
import {
  parseJsonBytesWithSchema,
  parseJsonWithSchema,
  playgroundClientKvDumpSchema,
  playgroundSnapshotManifestSchema,
  playgroundSqliteMemDumpSchema,
} from '@apps/system-console/playground/playground-snapshot-schema';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type {
  PlaygroundSnapshotInfo,
  PlaygroundSnapshotManifest,
  SystemCheckpoint,
} from '@pkgs/system-console/client';

export type SnapshotSessionCtx = CheckpointSessionCtx & {
  readonly store: ObjectStore;
};

const MANIFEST_VERSION = 2 as const;

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
  await deletePlaygroundSnapshots(store, [snapshotId]);
}

/** Delete many snapshot trees and rewrite the index once. */
export async function deletePlaygroundSnapshots(
  store: ObjectStore,
  snapshotIds: readonly string[]
): Promise<void> {
  const ids = [
    ...new Set(
      snapshotIds.map((id) => id.trim()).filter((id) => id.length > 0)
    ),
  ];
  if (ids.length === 0) throw new Error('snapshot id required');
  for (const id of ids) {
    await deleteSnapshotTree(store, id);
  }
  const index = await readIndex(store);
  const drop = new Set(ids);
  await putJson(store, INDEX_KEY, {
    snapshots: index.snapshots.filter((s) => !drop.has(s.id)),
  });
}

export async function purgeIncompatiblePlaygroundSnapshotsFromStore(
  store: ObjectStore
): Promise<number> {
  return purgeIncompatiblePlaygroundSnapshots(store);
}

export async function savePlaygroundSnapshot(
  ctx: SnapshotSessionCtx,
  label?: string
): Promise<PlaygroundSnapshotInfo> {
  const now = ctx.clock.now();
  const displayLabel = label?.trim() || defaultSnapshotLabel(now);
  const checkpoint = await captureCheckpoint(ctx, displayLabel);
  const id = slugLabel(label, now);
  const prefix = `snapshots/${id}/`;
  const keys = await putCheckpointBlobs(ctx.store, prefix, checkpoint);
  const manifest = manifestFromCheckpoint({
    id,
    label: displayLabel,
    createdAtMs: now,
    checkpoint,
    keys,
  });
  await putJson(ctx.store, `${prefix}manifest.json`, manifest);
  const info = toSnapshotInfo(manifest);
  const index = await readIndex(ctx.store);
  await putJson(ctx.store, INDEX_KEY, {
    snapshots: [
      { id: info.id, label: info.label, createdAtMs: info.createdAtMs },
      ...index.snapshots.filter((s) => s.id !== id),
    ],
  });
  return info;
}

async function putCheckpointBlobs(
  store: ObjectStore,
  prefix: string,
  checkpoint: SystemCheckpoint
): Promise<{ serverSql: string; clientSql: Record<string, string> }> {
  const serverSql = `${prefix}sql/server.bin`;
  await store.put(serverSql, checkpoint.serverSql, 'application/json');
  const clientSql: Record<string, string> = {};
  for (const clientId of checkpoint.clientIds) {
    const bytes = checkpoint.clientSql[clientId];
    if (bytes === undefined) continue;
    const key = `${prefix}sql/client_${clientId}.bin`;
    await store.put(key, bytes, 'application/json');
    clientSql[clientId] = key;
  }
  await putKvAndRooms(store, prefix, checkpoint);
  return { serverSql, clientSql };
}

async function putKvAndRooms(
  store: ObjectStore,
  prefix: string,
  checkpoint: SystemCheckpoint
): Promise<void> {
  for (const clientId of checkpoint.clientIds) {
    const kv = checkpoint.clientKv[clientId];
    if (kv === undefined) continue;
    await putJson(store, `${prefix}kv/client_${clientId}.json`, kv);
  }
  for (const topic of checkpoint.roomTopics) {
    const room = checkpoint.rooms[topic];
    if (room === undefined) continue;
    await putJson(store, `${prefix}rooms/${encodeURIComponent(topic)}.json`, {
      entries: room.entries,
      dedup: room.dedup,
    });
  }
}

function manifestFromCheckpoint(args: {
  readonly id: string;
  readonly label: string;
  readonly createdAtMs: number;
  readonly checkpoint: SystemCheckpoint;
  readonly keys: { serverSql: string; clientSql: Record<string, string> };
}): PlaygroundSnapshotManifest {
  const { id, label, createdAtMs, checkpoint, keys } = args;
  return {
    version: MANIFEST_VERSION,
    localSchemaVersion: checkpoint.localSchemaVersion,
    id,
    label,
    createdAtMs,
    clockMs: checkpoint.clockMs,
    clockPaused: checkpoint.clockPaused,
    clientIds: [...checkpoint.clientIds],
    roomTopics: [...checkpoint.roomTopics],
    partitions: [...checkpoint.partitions],
    skewByAddress: { ...checkpoint.skewByAddress },
    downAddresses: [...checkpoint.downAddresses],
    evictedAddresses: [...checkpoint.evictedAddresses],
    keys,
  };
}

async function readSqlBlob(
  store: ObjectStore,
  key: string
): Promise<Uint8Array> {
  const obj = await store.get(key);
  if (obj === null) throw new Error(`missing sql blob '${key}'`);
  const bytes = await readBody(obj.body);
  if (parseJsonBytesWithSchema(bytes, playgroundSqliteMemDumpSchema) === null) {
    throw new Error(`invalid sqlite-mem snapshot blob '${key}'`);
  }
  return bytes;
}

async function checkpointFromStore(
  store: ObjectStore,
  prefix: string,
  manifest: PlaygroundSnapshotManifest
): Promise<SystemCheckpoint> {
  const clientSql: Record<string, Uint8Array> = {};
  const clientKv: Record<string, Record<string, string>> = {};
  for (const id of manifest.clientIds) {
    const sqlKey = manifest.keys.clientSql[id];
    if (sqlKey !== undefined) clientSql[id] = await readSqlBlob(store, sqlKey);
    const text = await readText(store, `${prefix}kv/client_${id}.json`);
    if (text !== null) {
      const kv = parseJsonWithSchema(text, playgroundClientKvDumpSchema);
      if (kv !== null) clientKv[id] = kv;
    }
  }
  return {
    label: manifest.label,
    capturedAtMs: manifest.createdAtMs,
    clockMs: manifest.clockMs,
    clockPaused: manifest.clockPaused,
    localSchemaVersion: manifest.localSchemaVersion,
    clientIds: manifest.clientIds,
    roomTopics: manifest.roomTopics,
    partitions: manifest.partitions,
    skewByAddress: manifest.skewByAddress,
    downAddresses: manifest.downAddresses,
    evictedAddresses: manifest.evictedAddresses,
    sqlFormat: 'sqlm',
    serverSql: await readSqlBlob(store, manifest.keys.serverSql),
    clientSql,
    clientKv,
    rooms: await readRoomDumps(store, prefix, manifest.roomTopics),
  };
}

async function readRoomDumps(
  store: ObjectStore,
  prefix: string,
  roomTopics: readonly string[]
): Promise<SystemCheckpoint['rooms']> {
  const rooms: Record<string, SystemCheckpoint['rooms'][string]> = {};
  for (const topic of roomTopics) {
    const text = await readText(
      store,
      `${prefix}rooms/${encodeURIComponent(topic)}.json`
    );
    if (text === null) continue;
    let room: { entries?: unknown; dedup?: unknown };
    try {
      room = JSON.parse(text) as typeof room;
    } catch {
      continue;
    }
    rooms[topic] = {
      entries: (room.entries ?? []) as never,
      dedup: (room.dedup ?? {}) as never,
    };
  }
  return rooms;
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
  const compat = snapshotCompatibility(manifest);
  if (!compat.compatible || manifest.version !== 2) {
    throw new Error(
      compat.incompatibleReason ??
        `snapshot '${snapshotId}' is incompatible with the current schema`
    );
  }
  const checkpoint = await checkpointFromStore(ctx.store, prefix, manifest);
  await restoreCheckpoint(ctx, checkpoint);
  if (ctx.maps.clients.size === 0) {
    await ctx.spawnClient('alice');
    await ctx.spawnClient('bob');
  }
}
