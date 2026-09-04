import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';
import { migrateLocalSchema } from '@pkgs/sync-engine/client';
import {
  defineMutation,
  LIVE_ROW_SQL,
  type MutationError,
  softDeleteById,
  wrapMutationDb,
} from '@pkgs/sync-engine/shared';
import { exampleLocalSchema } from '@pkgs/sync-engine/sim';
import { z } from 'zod';

function testEnv() {
  let n = 0;
  return {
    actorId: 'actor',
    deviceId: 'device',
    accountId: 'acct',
    isAnon: false,
    now: () => new Date('2020-01-01T00:00:00.000Z'),
    createId: () => `id-${++n}`,
  };
}

describe('public API: defineMutation + wrapMutationDb', () => {
  test('managed-column inject + RETURNING capture on upsert', async () => {
    const db = SqlClientImplSqliteMem.open();
    await db.connect();
    await migrateLocalSchema(db, exampleLocalSchema);
    const env = testEnv();

    const setNoteBody = defineMutation({
      name: 'publicApiSetNote',
      args: z.object({ id: z.string(), body: z.string() }),
      async run({ tx, env: e }, { id, body }) {
        await tx.run(sql`
          INSERT INTO notes (id, folder_id, title, body, owner_id)
          VALUES (${id}, ${null}, ${''}, ${body}, ${e.actorId})
          ON CONFLICT (id) DO UPDATE SET
            body = excluded.body,
            owner_id = excluded.owner_id,
            deleted_at = NULL
        `);
      },
    });

    const wrapped = wrapMutationDb(db, env);
    await setNoteBody.run({ tx: wrapped.tx, env }, { id: 'n1', body: 'hello' });
    const capture = wrapped.getCapture();
    expect(capture.tables).toContain('notes');
    expect(capture.images['notes']?.[0]?.['id']).toBe('n1');
    expect(capture.images['notes']?.[0]?.['created_at']).toBeTruthy();
    expect(capture.images['notes']?.[0]?.['updated_at']).toBeTruthy();

    const rows = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'} AND ${LIVE_ROW_SQL}
    `);
    expect(rows[0]?.body).toBe('hello');
  });

  test('softDeleteById tombstones; LIVE_ROW_SQL excludes it', async () => {
    const db = SqlClientImplSqliteMem.open();
    await db.connect();
    await migrateLocalSchema(db, exampleLocalSchema);
    const env = testEnv();
    const now = env.now().toISOString();

    await db.run(sql`
      INSERT INTO notes (
        id, folder_id, title, body, owner_id, created_at, updated_at
      )
      VALUES (
        ${'n1'}, ${null}, ${''}, ${'x'}, ${'actor'}, ${now}, ${now}
      )
    `);

    const wrapped = wrapMutationDb(db, env);
    await softDeleteById(wrapped.tx, 'notes', 'n1', now);

    const live = await db.query(sql<{ id: string }>`
      SELECT id FROM notes WHERE ${LIVE_ROW_SQL}
    `);
    expect(live).toEqual([]);
    const tomb = await db.query(sql<{ deleted_at: string | null }>`
      SELECT deleted_at FROM notes WHERE id = ${'n1'}
    `);
    expect(tomb[0]?.deleted_at).toBe(now);
  });

  test('domain hard DELETE throws NO_HARD_DELETE', async () => {
    const db = SqlClientImplSqliteMem.open();
    await db.connect();
    await migrateLocalSchema(db, exampleLocalSchema);
    const env = testEnv();
    const wrapped = wrapMutationDb(db, env);

    await expect(
      wrapped.tx.run(sql`DELETE FROM notes WHERE id = ${'n1'}`)
    ).rejects.toMatchObject({
      code: 'NO_HARD_DELETE',
    } satisfies Partial<MutationError>);
  });
});
