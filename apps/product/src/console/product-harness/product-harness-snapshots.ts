/**
 * Full-runtime product-harness snapshot save / list / load via ObjectStore
 * (injected browser ObjectStore, normally OPFS).
 */

import {
  type CheckpointSessionCtx,
  captureCheckpoint,
  restoreCheckpoint,
} from '@apps/product/product-harness/product-harness-checkpoint';
import {
  deleteSnapshotTree,
  INDEX_KEY,
  pruneInvalidProductHarnessSnapshots,
  purgeIncompatibleProductHarnessSnapshots,
  putJson,
  readBody,
  readIndex,
  readText,
  snapshotCompatibility,
  toSnapshotInfo,
} from '@apps/product/product-harness/product-harness-snapshot-prune';
import {
  parseJsonWithSchema,
  productHarnessClientKvDumpSchema,
  productHarnessSnapshotManifestSchema,
} from '@apps/product/product-harness/product-harness-snapshot-schema';
import type {
  HarnessCheckpoint,
  ProductHarnessSnapshotInfo,
  ProductHarnessSnapshotManifest,
} from '@pkgs/harness-console/client';
import type { ObjectStore } from '@pkgs/object-store/interface';

export type SnapshotSessionCtx = CheckpointSessionCtx & {
  readonly store: ObjectStore;
};

/** Fixed ObjectStore id overwritten by product-harness sticky auto-save. */
export const PRODUCT_HARNESS_STICKY_SNAPSHOT_ID = 'latest';

const MANIFEST_VERSION = 3 as const;

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

export async function listProductHarnessSnapshots(
  store: ObjectStore
): Promise<readonly ProductHarnessSnapshotInfo[]> {
  return pruneInvalidProductHarnessSnapshots(store);
}

/** Delete snapshot object tree and drop it from the index. */
export async function deleteProductHarnessSnapshot(
  store: ObjectStore,
  snapshotId: string
): Promise<void> {
  await deleteProductHarnessSnapshots(store, [snapshotId]);
}

/** Delete many snapshot trees and rewrite the index once. */
export async function deleteProductHarnessSnapshots(
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

export async function purgeIncompatibleProductHarnessSnapshotsFromStore(
  store: ObjectStore
): Promise<number> {
  return purgeIncompatibleProductHarnessSnapshots(store);
}

async function writeHarnessSnapshot(
  ctx: SnapshotSessionCtx,
  args: {
    readonly id: string;
    readonly label: string;
    readonly createdAtMs: number;
  }
): Promise<ProductHarnessSnapshotInfo> {
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

export async function saveProductHarnessSnapshot(
  ctx: SnapshotSessionCtx,
  label?: string
): Promise<ProductHarnessSnapshotInfo> {
  const now = ctx.clock.now();
  const displayLabel = label?.trim() || defaultSnapshotLabel(now);
  return writeHarnessSnapshot(ctx, {
    id: slugLabel(label, now),
    label: displayLabel,
    createdAtMs: now,
  });
}

/** Upsert the sticky `latest` snapshot used for refresh auto-restore. */
export async function saveProductHarnessStickySnapshot(
  ctx: SnapshotSessionCtx
): Promise<ProductHarnessSnapshotInfo> {
  const now = ctx.clock.now();
  return writeHarnessSnapshot(ctx, {
    id: PRODUCT_HARNESS_STICKY_SNAPSHOT_ID,
    label: 'Latest (auto)',
    createdAtMs: now,
  });
}

async function putCheckpointBlobs(
  store: ObjectStore,
  prefix: string,
  checkpoint: HarnessCheckpoint
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
  checkpoint: HarnessCheckpoint
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
  readonly checkpoint: HarnessCheckpoint;
  readonly keys: { serverSql: string; clientSql: Record<string, string> };
}): ProductHarnessSnapshotManifest {
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
    serverIds: [...checkpoint.serverIds],
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
  manifest: ProductHarnessSnapshotManifest
): Promise<HarnessCheckpoint> {
  const clientSql: Record<string, Uint8Array> = {};
  const clientKv: Record<string, Record<string, string>> = {};
  for (const id of manifest.clientIds) {
    const sqlKey = manifest.keys.clientSql[id];
    if (sqlKey !== undefined) {
      clientSql[id] = await readOpaqueSqlBlob(store, sqlKey);
    }
    const text = await readText(store, `${prefix}kv/client_${id}.json`);
    if (text !== null) {
      const kv = parseJsonWithSchema(text, productHarnessClientKvDumpSchema);
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
    serverIds: manifest.serverIds,
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
): Promise<HarnessCheckpoint['rooms']> {
  const rooms: Record<string, HarnessCheckpoint['rooms'][string]> = {};
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

export async function loadProductHarnessSnapshot(
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
    productHarnessSnapshotManifestSchema
  );
  if (manifest === null) {
    throw new Error(`snapshot '${snapshotId}' has an invalid manifest`);
  }
  const compat = snapshotCompatibility(manifest);
  if (!compat.compatible || manifest.version !== 3) {
    throw new Error(
      compat.incompatibleReason ??
        `snapshot '${snapshotId}' is incompatible with the current schema`
    );
  }
  const checkpoint = await checkpointFromStore(ctx.store, prefix, manifest);
  await restoreCheckpoint(ctx, checkpoint);
  if (ctx.maps.clients.size === 0) {
    await ctx.spawnClient('client-a');
    await ctx.spawnClient('client-b');
  }
}
