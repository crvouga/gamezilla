import { expect, test } from 'bun:test';
import sql from '@pkgs/sql-shared/sql';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-shared/impl-mockingbird-sqlite';
import { migrateLocalSchema } from '@pkgs/sync-engine-client/local-schema-migrate';
import { exampleLocalSchema } from '@pkgs/sync-engine-harness/local-schema';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';

test('a mutation keeps the rows returned by its atomic write', async () => {
  // regression: sync-mutation-returning-discarded
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  try {
    await migrateLocalSchema(db, exampleLocalSchema);
    const wrapped = wrapMutationDb(db, {
      actorId: 'alice',
      deviceId: 'phone',
      accountId: 'alice',
      isAnon: false,
      now: () => new Date('2026-10-02T00:00:00.000Z'),
      createId: () => 'note',
    });
    const rows = await wrapped.tx.query(sql<{ id: string; owner_id: string }>`
      INSERT INTO notes (id, owner_id, title, body)
      VALUES (${'note'}, ${'alice'}, ${''}, ${'accepted'})
      ON CONFLICT (id) DO UPDATE SET updated_at = notes.updated_at
      RETURNING id, owner_id`);
    expect(rows).toEqual([{ id: 'note', owner_id: 'alice' }]);
    expect(wrapped.getCapture().tables).toContain('notes');
  } finally {
    await db.disconnect();
  }
});
