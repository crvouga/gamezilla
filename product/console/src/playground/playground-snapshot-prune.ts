/**
 * Validate playground snapshots and delete ones that fail the dump schema
 * (postgres-mem server + sqlite-mem clients). Schema-version mismatches stay
 * listed as incompatible (not auto-deleted).
 */

import type { ObjectStore } from '@pkgs/object-store/interface';
import type { PlaygroundSnapshotInfo } from '@pkgs/sim-console/client';
import { getLocalSchemaTargetVersion } from '@pkgs/sync-engine/client';
import {
  type PlaygroundSnapshotIndex,
  parseJsonBytesWithSchema,
  parseJsonWithSchema,
  playgroundPostgresMemDumpSchema,
  playgroundSnapshotIndexSchema,
  playgroundSnapshotInfoSchema,
  playgroundSnapshotManifestSchema,
  playgroundSqliteMemDumpSchema,
} from '@product/console/playground/playground-snapshot-schema';

const INDEX_KEY = 'index.json';

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
): Promise<number> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  await store.put(key, bytes, 'application/json');
  return bytes.byteLength;
}

/** Sum `StoredObject.size` for every key under `snapshots/{id}/`. */
export async function measureSnapshotTreeBytes(
  store: ObjectStore,
  id: string
): Promise<number> {
  const keys = await store.listKeys(`snapshots/${id}/`);
  let total = 0;
  for (const key of keys) {
    const obj = await store.get(key);
    if (obj === null) continue;
    total += obj.size;
    await obj.body.cancel().catch(() => undefined);
  }
  return total;
}

async function readText(
  store: ObjectStore,
  key: string
): Promise<string | null> {
  const obj = await store.get(key);
  if (obj === null) return null;
  const body = await readBody(obj.body);
  return new TextDecoder().decode(body);
}

async function deleteSnapshotTree(
  store: ObjectStore,
  id: string
): Promise<void> {
  const prefix = `snapshots/${id}/`;
  const keys = await store.listKeys(prefix);
  // Always include the manifest so prune cannot rediscover a half-deleted tree.
  const toDelete = new Set(keys);
  toDelete.add(`${prefix}manifest.json`);
  for (const key of toDelete) {
    await store.delete(key);
  }
}

async function isSqliteMemBlob(
  store: ObjectStore,
  key: string
): Promise<boolean> {
  const obj = await store.get(key);
  if (obj === null) return false;
  const bytes = await readBody(obj.body);
  if (bytes.byteLength === 0) return false;
  if (parseJsonBytesWithSchema(bytes, playgroundSqliteMemDumpSchema) !== null) {
    return true;
  }
  // Real SQLite serialize / WASM export — opaque image
  return bytes.byteLength >= 16;
}

async function isServerSqlBlob(
  store: ObjectStore,
  key: string
): Promise<boolean> {
  const obj = await store.get(key);
  if (obj === null) return false;
  const bytes = await readBody(obj.body);
  if (bytes.byteLength === 0) return false;
  if (
    parseJsonBytesWithSchema(bytes, playgroundPostgresMemDumpSchema) !== null
  ) {
    return true;
  }
  // Opaque non-JSON seed blobs (legacy); accept non-empty payload
  return bytes.byteLength >= 16;
}

/** Structural integrity only — schema version is annotated separately. */
async function isStructurallyValidSnapshot(
  store: ObjectStore,
  info: { readonly id: string }
): Promise<boolean> {
  const text = await readText(store, `snapshots/${info.id}/manifest.json`);
  if (text === null) return false;
  const manifest = parseJsonWithSchema(text, playgroundSnapshotManifestSchema);
  if (manifest === null || manifest.id !== info.id) return false;
  if (!(await isServerSqlBlob(store, manifest.keys.serverSql))) return false;
  for (const clientId of manifest.clientIds) {
    const key = manifest.keys.clientSql[clientId];
    if (key === undefined) return false;
    if (!(await isSqliteMemBlob(store, key))) return false;
  }
  return true;
}

export function snapshotCompatibility(manifest: {
  readonly version: 1 | 2;
  readonly localSchemaVersion?: number;
}): Pick<PlaygroundSnapshotInfo, 'compatible' | 'incompatibleReason'> {
  const required = getLocalSchemaTargetVersion();
  if (manifest.version !== 2) {
    return {
      compatible: false,
      incompatibleReason: `schema v${String(required)} required, snapshot missing/legacy`,
    };
  }
  if (manifest.localSchemaVersion !== required) {
    return {
      compatible: false,
      incompatibleReason: `schema v${String(required)} required, snapshot v${String(manifest.localSchemaVersion ?? 'missing')}`,
    };
  }
  return { compatible: true };
}

export function toSnapshotInfo(
  manifest: {
    readonly version: 1 | 2;
    readonly localSchemaVersion?: number;
    readonly id: string;
    readonly label: string;
    readonly createdAtMs: number;
  },
  totalBytes?: number
): PlaygroundSnapshotInfo {
  const compat = snapshotCompatibility(manifest);
  return {
    id: manifest.id,
    label: manifest.label,
    createdAtMs: manifest.createdAtMs,
    compatible: compat.compatible,
    ...(compat.incompatibleReason !== undefined
      ? { incompatibleReason: compat.incompatibleReason }
      : {}),
    ...(totalBytes !== undefined ? { totalBytes } : {}),
  };
}

async function readIndex(store: ObjectStore): Promise<PlaygroundSnapshotIndex> {
  const text = await readText(store, INDEX_KEY);
  if (text === null) return { snapshots: [] };
  return (
    parseJsonWithSchema(text, playgroundSnapshotIndexSchema) ?? {
      snapshots: [],
    }
  );
}

async function infoFromManifest(
  store: ObjectStore,
  id: string,
  knownTotalBytes?: number
): Promise<PlaygroundSnapshotInfo | null> {
  const text = await readText(store, `snapshots/${id}/manifest.json`);
  if (text === null) return null;
  const manifest = parseJsonWithSchema(text, playgroundSnapshotManifestSchema);
  if (manifest === null || manifest.id !== id) return null;
  if (!(await isStructurallyValidSnapshot(store, { id }))) return null;
  const totalBytes =
    knownTotalBytes ?? (await measureSnapshotTreeBytes(store, id));
  return toSnapshotInfo(manifest, totalBytes);
}

async function discoverSnapshotIds(store: ObjectStore): Promise<string[]> {
  const keys = await store.listKeys('snapshots/');
  const found = new Set<string>();
  for (const key of keys) {
    const match = /^snapshots\/([^/]+)\//.exec(key);
    if (match?.[1] !== undefined) found.add(match[1]);
  }
  return [...found];
}

function indexEntryShape(info: PlaygroundSnapshotInfo): {
  id: string;
  label: string;
  createdAtMs: number;
  totalBytes?: number;
} {
  return {
    id: info.id,
    label: info.label,
    createdAtMs: info.createdAtMs,
    ...(info.totalBytes !== undefined ? { totalBytes: info.totalBytes } : {}),
  };
}

/**
 * Drop index / object trees that fail the mixed postgres-mem / sqlite-mem
 * snapshot schema.
 * Recovers orphan trees with a valid manifest into the index.
 * Schema-mismatched dumps are kept and marked incompatible.
 */
export async function pruneInvalidPlaygroundSnapshots(
  store: ObjectStore
): Promise<readonly PlaygroundSnapshotInfo[]> {
  const index = await readIndex(store);
  const byId = new Map<string, PlaygroundSnapshotInfo>();
  let changed = false;

  for (const raw of index.snapshots) {
    if (!playgroundSnapshotInfoSchema.safeParse(raw).success) {
      changed = true;
      continue;
    }
    if (!(await isStructurallyValidSnapshot(store, raw))) {
      changed = true;
      await deleteSnapshotTree(store, raw.id);
      continue;
    }
    const recovered = await infoFromManifest(store, raw.id, raw.totalBytes);
    if (recovered === null) {
      changed = true;
      await deleteSnapshotTree(store, raw.id);
      continue;
    }
    if (raw.totalBytes !== recovered.totalBytes) changed = true;
    byId.set(recovered.id, recovered);
  }

  for (const id of await discoverSnapshotIds(store)) {
    if (byId.has(id)) continue;
    const recovered = await infoFromManifest(store, id);
    if (recovered !== null) {
      changed = true;
      byId.set(id, recovered);
    } else {
      changed = true;
      await deleteSnapshotTree(store, id);
    }
  }

  const listed = [...byId.values()].sort(
    (a, b) => b.createdAtMs - a.createdAtMs
  );
  if (changed) {
    await putJson(store, INDEX_KEY, {
      snapshots: listed.map(indexEntryShape),
    });
  }
  return listed;
}

/** Delete all snapshots whose schema version no longer matches. */
export async function purgeIncompatiblePlaygroundSnapshots(
  store: ObjectStore
): Promise<number> {
  const listed = await pruneInvalidPlaygroundSnapshots(store);
  const incompatible = listed.filter((s) => !s.compatible);
  if (incompatible.length === 0) return 0;
  for (const snap of incompatible) {
    await deleteSnapshotTree(store, snap.id);
  }
  const remaining = listed.filter((s) => s.compatible);
  await putJson(store, INDEX_KEY, {
    snapshots: remaining.map(indexEntryShape),
  });
  return incompatible.length;
}

export {
  deleteSnapshotTree,
  INDEX_KEY,
  putJson,
  readBody,
  readIndex,
  readText,
};
