import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { NOTES_ALL_TOPIC } from '@pkgs/sync-engine-harness-ts/topics';
import { readLastPushSeq } from '@pkgs/sync-engine-shared-ts/push-applied';
import fc from 'fast-check';
import { pushHost } from './push-delivery-fixture';

async function burst(length: number) {
  const host = await pushHost();
  try {
    const before = host.snapshots();
    const receive = host.listeners.get(NOTES_ALL_TOPIC);
    if (receive === undefined)
      throw new Error('The notes topic was not subscribed');
    for (let i = 0; i < length; i++)
      receive({
        pushSeq: String(i + 2),
        tables: ['notes'],
        rows: {
          notes: [
            {
              id: 'note',
              owner_id: 'alice',
              title: 'A note',
              body: `revision-${i}`,
              folder_id: null,
              space_id: null,
              created_at: new Date(0).toISOString(),
              updated_at: new Date(i + 1).toISOString(),
              deleted_at: null,
            },
          ],
        },
      });
    for (let i = 0; i < 500; i++) {
      await Promise.resolve();
      if (i % 20 === 0) host.time.clock.advance(10);
    }
    const rows = await host.db.query(
      sql<{ body: string }>`SELECT body FROM notes WHERE id = ${'note'}`
    );
    return {
      body: rows[0]?.body,
      seq: await readLastPushSeq(host.db, NOTES_ALL_TOPIC, {
        now: host.time.clock.now,
      }),
      refetches: host.snapshots() - before,
    };
  } finally {
    await host.engine.disconnect();
    host.raw.close();
  }
}

// regression: contiguous-pushes-race-their-applied-sequence
test('two consecutive pushes apply in delivery order without another snapshot', async () => {
  expect(await burst(2)).toEqual({
    body: 'revision-1',
    seq: '3',
    refetches: 0,
  });
});

test('every contiguous burst keeps its final row and sequence without refetching', async () => {
  await assertProperty(
    'contiguous push delivery order',
    fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (length) => {
      expect(await burst(length)).toEqual({
        body: `revision-${length - 1}`,
        seq: String(length + 1),
        refetches: 0,
      });
    })
  );
});
