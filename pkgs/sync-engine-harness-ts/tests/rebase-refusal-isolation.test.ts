import { expect, test } from 'bun:test';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createMutationClient } from '@pkgs/sync-engine-client-ts/create-mutation-client';
import { ensureFrameworkSchema } from '@pkgs/sync-engine-client-ts/local-schema';
import {
  applyFullMerge,
  applyRowImages,
  type MergeApplierDeps,
} from '@pkgs/sync-engine-client-ts/merge';
import { createTableChangeBus } from '@pkgs/sync-engine-client-ts/table-change-bus';
import { setNote } from '@pkgs/sync-engine-harness-ts/mutations';
import { exampleAppSchema } from '@pkgs/sync-engine-harness-ts/schema';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import { z } from 'zod';

/** Writes first and checks after: an edit to a note whose folder is gone is refused. */
const editFiledNote = defineMutation({
  name: 'editFiledNote',
  args: z.object({ id: z.string(), body: z.string() }),
  async run({ tx }, { id, body }) {
    await tx.run(sql`
      UPDATE notes SET body = ${body}
      WHERE id = ${id} AND deleted_at IS NULL
    `);
    const filed = await tx.query(sql<{ id: string }>`
      SELECT folders.id FROM notes
      JOIN folders ON folders.id = notes.folder_id
      WHERE notes.id = ${id} AND folders.deleted_at IS NULL
    `);
    if (filed.length === 0)
      throw new MutationError('FOLDER_GONE', 'The folder was deleted.');
  },
});

const AT = '2026-11-26T09:00:00.000Z';
const LATER = '2026-11-26T09:05:00.000Z';

const folder = (deletedAt: string | null): QueryRow => ({
  id: 'groceries',
  title: 'Groceries',
  owner_id: 'bob',
  created_at: AT,
  updated_at: deletedAt ?? AT,
  deleted_at: deletedAt,
});

const note = (id: string, body: string, updatedAt = AT): QueryRow => ({
  id,
  folder_id: id === 'list' ? 'groceries' : null,
  space_id: null,
  title: 'List',
  body,
  owner_id: 'bob',
  created_at: AT,
  updated_at: updatedAt,
  deleted_at: null,
});

const adapters = [
  { name: 'SQLite', open: () => SqlClientImplBunSqlite.openMemory() },
  { name: 'simulation', open: () => SqlClientImplMockingbirdSqlite.open() },
] as const;

type Rows = Readonly<Record<string, readonly QueryRow[]>>;

const deliveries = {
  snapshot: (deps: MergeApplierDeps, rows: Rows) =>
    applyFullMerge(deps, {
      scopeHash: 'alice',
      checkpoint: '00000000000000000002',
      hash: 'second',
      tables: rows,
    }),
  push: (deps: MergeApplierDeps, rows: Rows) => applyRowImages(deps, rows),
} as const;

async function openDevice(db: SqlClient) {
  await db.connect();
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
    deviceId: 'phone',
    isAnon: false,
    now: () => new Date(AT),
    createId,
  };
  const registry = {
    [editFiledNote.name]: editFiledNote,
    [setNote.name]: setNote,
  };
  const deps = {
    db,
    env,
    registry,
    bus: createTableChangeBus(),
    clientId: 'phone',
  };
  const client = createMutationClient({
    db,
    env,
    registry,
    createId,
    ids: { clientId: 'phone' },
    connectivity: { isOnline: () => false },
  });
  return { deps, client };
}

for (const adapter of adapters) {
  for (const [delivery, deliver] of Object.entries(deliveries)) {
    test(`${adapter.name} ${delivery}: a queued write refused on rebase leaves nothing behind while the writes around it stay`, async () => {
      // regression: rebase-refused-write-commits-partial-effect
      const db = adapter.open();
      try {
        const { deps, client } = await openDevice(db);
        await applyFullMerge(deps, {
          scopeHash: 'alice',
          checkpoint: '00000000000000000001',
          hash: 'first',
          tables: {
            folders: [folder(null)],
            notes: [
              note('earlier', ''),
              note('list', 'eggs'),
              note('later', ''),
            ],
          },
        });
        expect(
          await client.mutate(setNote, { id: 'earlier', body: 'jam' })
        ).toMatchObject({ ok: true });
        expect(
          await client.mutate(editFiledNote, { id: 'list', body: 'milk' })
        ).toMatchObject({ ok: true });
        expect(
          await client.mutate(setNote, { id: 'later', body: 'bread' })
        ).toMatchObject({ ok: true });

        // Bob deleted the folder and edited the list before the phone synced.
        await deliver(deps, {
          folders: [folder(LATER)],
          notes: [
            note('earlier', ''),
            note('list', 'eggs, butter', LATER),
            note('later', ''),
          ],
        });

        expect(
          await db.query(
            sql<{ id: string; body: string }>`
              SELECT id, body FROM notes WHERE deleted_at IS NULL ORDER BY id
            `
          )
        ).toEqual([
          { id: 'earlier', body: 'jam' },
          { id: 'later', body: 'bread' },
          { id: 'list', body: 'eggs, butter' },
        ]);
        expect(
          await db.query(
            sql<{ name: string }>`
              SELECT name FROM sync_engine_mutations
              WHERE deleted_at IS NULL ORDER BY seq
            `
          )
        ).toEqual([
          { name: 'setNote' },
          { name: 'editFiledNote' },
          { name: 'setNote' },
        ]);
      } finally {
        await db.disconnect();
      }
    });
  }
}
