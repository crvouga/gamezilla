import { assert } from '@gamezilla/lib/assert';
import type { SubscribablePatchDbLike } from '../subscribable';
import { InMemoryEntityStore } from './in-memory-entity-store';

const storeByDb = new WeakMap<SubscribablePatchDbLike, InMemoryEntityStore>();

export function setInMemoryStoreForDb(
  db: SubscribablePatchDbLike,
  store: InMemoryEntityStore
): void {
  storeByDb.set(db, store);
}

export function getInMemoryStoreForDb(
  db: SubscribablePatchDbLike
): InMemoryEntityStore {
  const store = storeByDb.get(db);
  assert.defined(store, 'InMemoryEntityStore missing for db');
  return store;
}

export function clearInMemoryStoreForDb(db: SubscribablePatchDbLike): void {
  storeByDb.delete(db);
}

