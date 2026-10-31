import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import { createMutationClient } from '@pkgs/sync-engine-client-ts/create-mutation-client';
import { ensureFrameworkSchema } from '@pkgs/sync-engine-client-ts/local-schema';
import { applyFullMerge } from '@pkgs/sync-engine-client-ts/merge';
import { createTableChangeBus } from '@pkgs/sync-engine-client-ts/table-change-bus';
import { setNote } from '@pkgs/sync-engine-harness-ts/mutations';
import { exampleAppSchema } from '@pkgs/sync-engine-harness-ts/schema';
import { hashQueryTables } from '@pkgs/sync-engine-shared-ts/canonical';

/** Fixed workload shared by correctness checks and the wall-clock benchmark. */
export async function openPerformanceFixture() {
  const db = SqlClientImplBunSqlite.openMemory();
  await ensureFrameworkSchema(db);
  await reconcileSqliteSchema(db, exampleAppSchema, {
    ownership: 'declared-only',
  });
  let id = 0;
  const createId = () =>
    `00000000-0000-4000-8000-${(++id).toString(16).padStart(12, '0')}`;
  const env = {
    actorId: 'alice',
    accountId: 'alice',
    deviceId: 'device',
    isAnon: false,
    now: () => new Date('2026-10-30T00:00:00Z'),
    createId,
  };
  const registry = { [setNote.name]: setNote };
  const client = createMutationClient({
    db,
    env,
    registry,
    createId,
    ids: { clientId: 'device' },
    connectivity: { isOnline: () => false },
  });
  for (let i = 0; i < 100; i++) {
    const result = await client.mutate(setNote, {
      id: `note-${i}`,
      body: 'pending',
    });
    if (!result.ok)
      throw new Error('Performance fixture could not queue a write');
  }
  const rows = Array.from({ length: 1000 }, (_, i) => ({
    id: `note-${i}`,
    title: '',
    body: 'x'.repeat(800),
    owner_id: 'alice',
    folder_id: null,
    space_id: null,
    created_at: env.now().toISOString(),
    updated_at: env.now().toISOString(),
    deleted_at: null,
  }));
  const tables = { notes: rows };
  const padding =
    1024 * 1024 - new TextEncoder().encode(JSON.stringify(tables)).length;
  if (padding < 0)
    throw new Error('Performance fixture exceeds its byte budget');
  rows[999]!.body += 'x'.repeat(padding);
  const deps = {
    db,
    env,
    registry,
    bus: createTableChangeBus(),
    clientId: 'device',
  };
  let checkpoint = 0;
  return {
    db,
    tables,
    hash: () => hashQueryTables(tables),
    merge: () =>
      applyFullMerge(deps, {
        tables,
        scopeHash: 'benchmark',
        checkpoint: String(++checkpoint).padStart(20, '0'),
        hash: hashQueryTables(tables),
      }),
  };
}
