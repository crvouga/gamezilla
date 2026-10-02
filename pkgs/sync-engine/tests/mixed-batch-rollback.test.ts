import { expect, test } from 'bun:test';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';
import { sql } from '@pkgs/sql';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';
import { exampleAppSchema, pendingNote } from '@pkgs/sync-engine/harness';
import {
  createSyncApp,
  syncEngineServerSchema,
} from '@pkgs/sync-engine/server';
import {
  mutationRegistry,
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine/shared';

test('a refused mutation rolls back its writes without discarding the other batch changes', async () => {
  // regression: sync-refused-write-left-domain-changes
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  try {
    for (const schema of [syncEngineServerSchema, exampleAppSchema])
      await reconcileSqliteSchema(db, schema, { ownership: 'declared-only' });
    let id = 0;
    const app = createSyncApp({
      resolveAuth: async () => ({
        actorId: 'alice',
        deviceId: 'phone',
        accountId: 'alice',
        isAnon: false,
      }),
      getSql: () => db,
      queries: {},
      mutations: mutationRegistry([pendingNote]),
      now: () => 1700000000000,
      createId: () => `batch-${++id}`,
    });
    const response = await app.request('http://test/mutations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
      },
      body: JSON.stringify({
        mutations: ['milk', 'refused', 'bread'].map((body, seq) => ({
          id: `change-${seq}`,
          name: pendingNote.name,
          args: JSON.stringify({ id: 'Groceries', title: 'Groceries', body }),
          clientId: 'phone',
          seq: seq + 1,
          createdAt: '2023-11-14T22:13:20.000Z',
          originTraceparent: null,
        })),
      }),
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      verdicts: { status: string }[];
    };
    expect(result.verdicts.map((verdict) => verdict.status)).toEqual([
      'applied',
      'rejected',
      'applied',
    ]);
    expect(
      await db.query(sql<{ body: string }>`SELECT body FROM notes`)
    ).toEqual([{ body: 'bread' }]);
    expect(
      await db.query(
        sql<{
          status: string;
        }>`SELECT status FROM sync_engine_mutations_applied WHERE mutation_id = ${'change-1'}`
      )
    ).toEqual([{ status: 'rejected' }]);
    expect(
      await db.query(
        sql<{ code: string }>`SELECT code FROM sync_engine_write_rejections`
      )
    ).toEqual([{ code: 'REFUSED' }]);
  } finally {
    await db.disconnect();
  }
});
