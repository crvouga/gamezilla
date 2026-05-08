import { assert } from '@gamezilla/lib/assert';
import type { PatchDb } from '../interface';
import type { InMemoryEntityStore } from './in-memory-entity-store';

/**
 * Bulk-hydrates the in-memory store from the durable local PatchDb backend.
 *
 * Uses snapshot mode (entities) and expects `patches` to be irrelevant for the
 * sync React read path.
 */
export async function hydrateInMemoryStoreFromSqlite(
  local: PatchDb,
  store: InMemoryEntityStore
): Promise<void> {
  const [res] = await local.read([{}]);
  assert.ok(
    res !== null && res !== undefined,
    'read([{}]) must return one result'
  );
  store.upsertEntities(res.entities);
}
