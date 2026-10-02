/** Attempt-local commit records; immutable successful content remains shared. */

import { readUtf8 } from '@pkgs/object-store/helpers';
import { ObjectStoreWithPrefix } from '@pkgs/object-store/impl-with-prefix';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { commitKey } from './keys';
import type { CommitRecord } from './protocol';

export function publicationStore(
  store: ObjectStore,
  publicationId: string
): ObjectStore {
  if (
    !/^[a-zA-Z0-9._:-]+$/.test(publicationId) ||
    publicationId === '.' ||
    publicationId === '..'
  )
    throw new Error('Invalid report publication id');
  const root = `attempts/${publicationId}/`;
  const keyOf = (key: string) =>
    key.startsWith('commits/') ? root + key : key;
  const scoped: ObjectStore = {
    get: (key) => store.get(keyOf(key)),
    head: (key) => store.head(keyOf(key)),
    put: (key, bytes, type) => store.put(keyOf(key), bytes, type),
    delete: (key) => store.delete(keyOf(key)),
    getUri: (key) => store.getUri(keyOf(key)),
    async listKeys(prefix = '') {
      const keys = await store.listKeys(keyOf(prefix));
      return keys.map((key) =>
        key.startsWith(root) ? key.slice(root.length) : key
      );
    },
    withPrefix: (prefix) => new ObjectStoreWithPrefix(scoped, prefix),
  };
  return scoped;
}

export async function reportStore(
  store: ObjectStore,
  sha: string
): Promise<ObjectStore> {
  const text = await readUtf8(store, commitKey(sha));
  if (text === null) return store;
  const stored = JSON.parse(text) as CommitRecord | { publicationId: string };
  return 'publicationId' in stored
    ? publicationStore(store, stored.publicationId)
    : store;
}
