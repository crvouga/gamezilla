/**
 * Full-runtime product-simulator snapshot save / list / load via ObjectStore
 * (injected browser ObjectStore, normally OPFS).
 */

import {
  type CheckpointSessionCtx,
  captureCheckpoint,
  restoreCheckpoint,
} from '@apps/product/product-simulator/product-simulator-checkpoint';
import {
  deleteSnapshotTree,
  INDEX_KEY,
  pruneInvalidProductSimulatorSnapshots,
  purgeIncompatibleProductSimulatorSnapshots,
  putJson,
  readBody,
  readIndex,
  readText,
  snapshotCompatibility,
  toSnapshotInfo,
} from '@apps/product/product-simulator/product-simulator-snapshot-prune';
import {
  parseJsonWithSchema,
  productSimulatorClientKvDumpSchema,
  productSimulatorSnapshotManifestSchema,
} from '@apps/product/product-simulator/product-simulator-snapshot-schema';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type {
  ProductSimulatorSnapshotInfo,
  ProductSimulatorSnapshotManifest,
  SimCheckpoint,
} from '@pkgs/sim-console/client';

export type SnapshotSessionCtx = CheckpointSessionCtx & {
  readonly store: ObjectStore;
};

/** Fixed ObjectStore id overwritten by product-simulator sticky auto-save. */
export const PRODUCT_SIMULATOR_STICKY_SNAPSHOT_ID = 'latest';

const MANIFEST_VERSION = 2 as const;

function slugLabel(label: string | undefined, now: number): string {
  const trimmed = label?.trim() ?? '';
  const base =
    trimmed.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'snap';
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

export async function listProductSimulatorSnapshots(
  store: ObjectStore
): Promise<readonly ProductSimulatorSnapshotInfo[]> {
  return pruneInvalidProductSimulatorSnapshots(store);
}

/** Delete snapshot object tree and drop it from the index. */
export async function deleteProductSimulatorSnapshot(
  store: ObjectStore,
  snapshotId: string
): Promise<void> {
  await deleteProductSimulatorSnapshots(store, [snapshotId]);
}

/** Delete many snapshot trees and rewrite the index once. */
export async function deleteProductSimulatorSnapshots(
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

export async function purgeIncompatibleProductSimulatorSnapshotsFromStore(
  store: ObjectStore
): Promise<number> {
  return purgeIncompatibleProductSimulatorSnapshots(store);
}

async function writeSimulatorSnapshot(
  ctx: SnapshotSessionCtx,
  args: {
    readonly id: string;
    readonly label: string;
    readonly createdAtMs: number;
  }
): Promise<ProductSimulatorSnapshotInfo> {
  const checkpoint = await captureCheckpoint(ctx, args.label);
  await deleteSnapshotTree(ctx.store, args.id);
  const prefix = `snapshots/${args.id}/`;
  const { keys, blobBytes } = await putCheckpointBlobs(
    ctx.store,
    prefix,
    checkpoint
  );
  const manifest = manifestFromCheckpoint({
    id: args.id,
    label: args.label,
    createdAtMs: args.createdAtMs,
    checkpoint,
    keys,
  });
  const manifestBytes = await putJson(
    ctx.store,
    `${prefix}manifest.json`,
    manifest
  );
  const totalBytes = blobBytes + manifestBytes;
  const info = toSnapshotInfo(manifest, totalBytes);
  const index = await readIndex(ctx.store);
  await putJson(ctx.store, INDEX_KEY, {
    snapshots: [
      {
        id: info.id,
        label: info.label,
        createdAtMs: info.createdAtMs,
        totalBytes,
      },
      ...index.snapshots.filter((s) => s.id !== args.id),
    ],
  });
  return info;
}

export async function saveProductSimulatorSnapshot(
  ctx: SnapshotSessionCtx,
  label?: string
): Promise<ProductSimulatorSnapshotInfo> {
  const now = ctx.clock.now();
  const displayLabel = label?.trim() || defaultSnapshotLabel(now);
  return writeSimulatorSnapshot(ctx, {
    id: slugLabel(label, now),
    label: displayLabel,
    createdAtMs: now,
  });
}

/** Upsert the sticky `latest` snapshot used for refresh auto-restore. */
export async function saveProductSimulatorStickySnapshot(
  ctx: SnapshotSessionCtx
): Promise<ProductSimulatorSnapshotInfo> {
  const now = ctx.clock.now();
  return writeSimulatorSnapshot(ctx, {
    id: PRODUCT_SIMULATOR_STICKY_SNAPSHOT_ID,
    label: 'Latest (auto)',
    createdAtMs: now,
  });
}

async function putCheckpointBlobs(
  store: ObjectStore,
  prefix: string,
  checkpoint: SimCheckpoint
): Promise<{
  readonly keys: { serverSql: string; clientSql: Record<string, string> };
  readonly blobBytes: number;
}> {
  let blobBytes = 0;
  const serverSql = `${prefix}sql/server.bin`;
  await store.put(serverSql, checkpoint.serverSql, 'application/octet-stream');
  blobBytes += checkpoint.serverSql.byteLength;
  const clientSql: Record<string, string> = {};
  for (const clientId of checkpoint.clientIds) {
    const bytes = checkpoint.clientSql[clientId];
    if (bytes === undefined) continue;
    const key = `${prefix}sql/client_${clientId}.bin`;
    await store.put(key, bytes, 'application/octet-stream');
    blobBytes += bytes.byteLength;
    clientSql[clientId] = key;
  }
  blobBytes += await putKvAndRooms(store, prefix, checkpoint);
  return { keys: { serverSql, clientSql }, blobBytes };
}

async function putKvAndRooms(
  store: ObjectStore,
  prefix: string,
  checkpoint: SimCheckpoint
): Promise<number> {
  let blobBytes = 0;
  for (const clientId of checkpoint.clientIds) {
    const kv = checkpoint.clientKv[clientId];
    if (kv === undefined) continue;
    blobBytes += await putJson(
      store,
      `${prefix}kv/client_${clientId}.json`,
      kv
    );
  }
  for (const topic of checkpoint.roomTopics) {
    const room = checkpoint.rooms[topic];
    if (room === undefined) continue;
    blobBytes += await putJson(
      store,
      `${prefix}rooms/${encodeURIComponent(topic)}.json`,
      {
        entries: room.entries,
        dedup: room.dedup,
      }
    );
  }
  return blobBytes;
}

function manifestFromCheckpoint(args: {
  readonly id: string;
  readonly label: string;
  readonly createdAtMs: number;
  readonly checkpoint: SimCheckpoint;
  readonly keys: { serverSql: string; clientSql: Record<string, string> };
}): ProductSimulatorSnapshotManifest {
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
    sqlFormat: checkpoint.sqlFormat,
    keys,
  };
}

async function readOpaqueSqlBlob(
  store: ObjectStore,
  key: string
): Promise<Uint8Array> {
  const obj = await store.get(key);
  if (obj === null) throw new Error(`missing sql blob '${key}'`);
  const bytes = await readBody(obj.body);
  if (bytes.byteLength === 0) {
    throw new Error(`empty sql blob '${key}'`);
  }
  return bytes;
}

async function checkpointFromStore(
  store: ObjectStore,
  prefix: string,
  manifest: ProductSimulatorSnapshotManifest
): Promise<SimCheckpoint> {
  const clientSql: Record<string, Uint8Array> = {};
  const clientKv: Record<string, Record<string, string>> = {};
  for (const id of manifest.clientIds) {
    const sqlKey = manifest.keys.clientSql[id];
    if (sqlKey !== undefined) {
      clientSql[id] = await readOpaqueSqlBlob(store, sqlKey);
    }
    const text = await readText(store, `${prefix}kv/client_${id}.json`);
    if (text !== null) {
      const kv = parseJsonWithSchema(text, productSimulatorClientKvDumpSchema);
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
    sqlFormat: manifest.sqlFormat ?? 'mixed-pgmm-sqlm',
    serverSql: await readOpaqueSqlBlob(store, manifest.keys.serverSql),
    clientSql,
    clientKv,
    rooms: await readRoomDumps(store, prefix, manifest.roomTopics),
  };
}

async function readRoomDumps(
  store: ObjectStore,
  prefix: string,
  roomTopics: readonly string[]
): Promise<SimCheckpoint['rooms']> {
  const rooms: Record<string, SimCheckpoint['rooms'][string]> = {};
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

export async function loadProductSimulatorSnapshot(
  ctx: SnapshotSessionCtx,
  snapshotId: string
): Promise<void> {
  const prefix = `snapshots/${snapshotId}/`;
  const text = await readText(ctx.store, `${prefix}manifest.json`);
  if (text === null) {
    throw new Error(`snapshot '${snapshotId}' not found`);
  }
  const manifest = parseJsonWithSchema(
    text,
    productSimulatorSnapshotManifestSchema
  );
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
