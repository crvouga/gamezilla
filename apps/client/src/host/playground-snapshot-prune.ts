/**
 * Validate playground snapshots and delete ones that fail the AlaSQL schema.
 */

import {
  type PlaygroundSnapshotIndex,
  parseJsonBytesWithSchema,
  parseJsonWithSchema,
  playgroundAlaSqlDumpSchema,
  playgroundSnapshotIndexSchema,
  playgroundSnapshotInfoSchema,
  playgroundSnapshotManifestSchema,
} from '@apps/client/host/playground-snapshot-schema';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { PlaygroundSnapshotInfo } from '@pkgs/system-console/client';

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
): Promise<void> {
  const text = JSON.stringify(value);
  await store.put(key, new TextEncoder().encode(text), 'application/json');
}

async function readText(
  store: ObjectStore,
  key: string
): Promise<string | null> {
  const obj = await store.get(key);
  if (obj === null) return null;
  return new TextDecoder().decode(await readBody(obj.body));
}

async function deleteSnapshotTree(
  store: ObjectStore,
  id: string
): Promise<void> {
  const keys = await store.listKeys(`snapshots/${id}/`);
  for (const key of keys) {
    await store.delete(key);
  }
}

async function isAlaSqlBlob(store: ObjectStore, key: string): Promise<boolean> {
  const obj = await store.get(key);
  if (obj === null) return false;
  const dump = parseJsonBytesWithSchema(
    await readBody(obj.body),
    playgroundAlaSqlDumpSchema
  );
  return dump !== null;
}

async function isValidSnapshot(
  store: ObjectStore,
  info: PlaygroundSnapshotInfo
): Promise<boolean> {
  if (!playgroundSnapshotInfoSchema.safeParse(info).success) return false;
  const text = await readText(store, `snapshots/${info.id}/manifest.json`);
  if (text === null) return false;
  const manifest = parseJsonWithSchema(text, playgroundSnapshotManifestSchema);
  if (manifest === null || manifest.id !== info.id) return false;
  if (!(await isAlaSqlBlob(store, manifest.keys.serverSql))) return false;
  for (const clientId of manifest.clientIds) {
    const key = manifest.keys.clientSql[clientId];
    if (key === undefined) return false;
    if (!(await isAlaSqlBlob(store, key))) return false;
  }
  return true;
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
  id: string
): Promise<PlaygroundSnapshotInfo | null> {
  const text = await readText(store, `snapshots/${id}/manifest.json`);
  if (text === null) return null;
  const manifest = parseJsonWithSchema(text, playgroundSnapshotManifestSchema);
  if (manifest === null || manifest.id !== id) return null;
  const info: PlaygroundSnapshotInfo = {
    id: manifest.id,
    label: manifest.label,
    createdAtMs: manifest.createdAtMs,
  };
  if (!(await isValidSnapshot(store, info))) return null;
  return info;
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

/**
 * Drop index / object trees that fail the AlaSQL snapshot schema.
 * Recovers orphan trees with a valid manifest into the index.
 */
export async function pruneInvalidPlaygroundSnapshots(
  store: ObjectStore
): Promise<readonly PlaygroundSnapshotInfo[]> {
  const index = await readIndex(store);
  const byId = new Map<string, PlaygroundSnapshotInfo>();
  let changed = false;

  for (const info of index.snapshots) {
    if (await isValidSnapshot(store, info)) {
      byId.set(info.id, info);
    } else {
      changed = true;
      await deleteSnapshotTree(store, info.id);
    }
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

  const valid = [...byId.values()].sort(
    (a, b) => b.createdAtMs - a.createdAtMs
  );
  if (changed) {
    await putJson(store, INDEX_KEY, { snapshots: valid });
  }
  return valid;
}

export {
  deleteSnapshotTree,
  INDEX_KEY,
  putJson,
  readBody,
  readIndex,
  readText,
};
