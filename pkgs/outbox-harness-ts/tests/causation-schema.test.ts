import { expect, test } from 'bun:test';
import { createMessageNamespace } from '@pkgs/message-shared-ts/message';
import { withOutboxCausation } from '@pkgs/outbox-shared-ts/causation';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import { reconcileOutbox } from '@pkgs/outbox-shared-ts/reconcile';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';

test('causation reconciliation preserves pre-existing pending events and indexes new families', async () => {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await db.run(sql`CREATE TABLE outbox_events (
      id TEXT NOT NULL PRIMARY KEY, type TEXT, payload TEXT, available_at TEXT,
      created_at TEXT, updated_at TEXT, deleted_at TEXT
    )`);
    const timestamp = '2026-10-01T00:00:00.000Z';
    await db.run(sql`INSERT INTO outbox_events (id, type, payload, available_at, created_at, updated_at, deleted_at)
      VALUES (${'old'}, ${'example:pending'}, ${'{}'}, ${timestamp}, ${timestamp}, ${timestamp}, ${null})`);
    await reconcileOutbox(db);
    const Ping = createMessageNamespace('example')(
      'pending',
      (value): value is Record<string, never> =>
        typeof value === 'object' && value !== null
    );
    await new Outbox({
      tx: withOutboxCausation(db, '["alice","write"]'),
      env: { now: () => new Date(timestamp), createId: () => 'new' },
    }).send({ id: 'new', message: Ping({}) });
    expect(
      await db.query(
        sql<{
          id: string;
          causation_id: string | null;
        }>`SELECT id, causation_id FROM outbox_events ORDER BY id`
      )
    ).toEqual([
      { id: 'new', causation_id: '["alice","write"]' },
      { id: 'old', causation_id: null },
    ]);
    expect(
      await db.query(
        sql<{
          payload: string;
          available_at: string;
        }>`SELECT payload, available_at FROM outbox_events WHERE id = ${'old'}`
      )
    ).toEqual([{ payload: '{}', available_at: timestamp }]);
    const indexes = await db.query(
      sql<{
        sql: string | null;
      }>`SELECT sql FROM sqlite_master WHERE type = ${'index'} AND tbl_name = ${'outbox_events'}`
    );
    expect(indexes.some((index) => index.sql?.includes('causation_id'))).toBe(
      true
    );
  } finally {
    await db.disconnect();
  }
});
