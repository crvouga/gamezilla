import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { NOTES_ALL_TOPIC } from '@pkgs/sync-engine-harness-ts/topics';
import fc from 'fast-check';
import { pushHost } from './push-delivery-fixture';

function note(body: string, timestamp: number) {
  return {
    id: 'bob-note',
    owner_id: 'bob',
    title: 'bob-note',
    body,
    folder_id: null,
    space_id: null,
    deleted_at: null,
    created_at: new Date(3300).toISOString(),
    updated_at: new Date(timestamp).toISOString(),
  };
}

async function flushPush(): Promise<void> {
  for (let n = 0; n < 300; n++) await Promise.resolve();
}

async function confirmedBeforeHint(timestamp: number): Promise<void> {
  const host = await pushHost();
  try {
    const receive = host.listeners.get(NOTES_ALL_TOPIC)!;
    receive({
      pushSeq: '2',
      checkpoint: '10',
      tables: ['notes'],
      rows: { notes: [note('bob 10', 3300)] },
    });
    await flushPush();
    receive({
      pushSeq: '0',
      optimistic: true,
      tables: ['notes'],
      rows: { notes: [note('bob 4', timestamp)] },
    });
    await flushPush();
    const rows = await host.db.query(
      sql<{ body: string }>`SELECT body FROM notes WHERE id = ${'bob-note'}`
    );
    expect(rows[0]?.body).toBe('bob 10');
  } finally {
    await host.engine.disconnect();
    host.raw.close();
  }
}

// regression: delayed-optimistic-hint-reverts-confirmed-note
test('a same-timestamp pushSeq zero hint cannot replace the confirmed bob 10 with bob 4', async () => {
  await confirmedBeforeHint(3300);
});

test('a delayed hint cannot replace confirmed content regardless of its device clock', async () => {
  await assertProperty(
    'confirmed notes survive stale hints from skewed device clocks',
    fc.asyncProperty(
      fc.integer({ min: -86_400_000, max: 86_400_000 }),
      async (skew) => {
        await confirmedBeforeHint(3300 + skew);
      }
    )
  );
});

test('repeated and reordered hints fetch current accepted work without painting their unconfirmed rows', async () => {
  await assertProperty(
    'peer hints preserve confirmed content and wake authoritative progress',
    fc.asyncProperty(
      fc.array(
        fc.record({
          revision: fc.integer({ min: 1, max: 10 }),
          skew: fc.integer({ min: -86_400_000, max: 86_400_000 }),
          writer: fc.constantFrom('alice', 'bob'),
        }),
        { minLength: 1, maxLength: 8 }
      ),
      async (hints) => {
        const host = await pushHost();
        const receive = host.listeners.get(NOTES_ALL_TOPIC)!;
        const body = async () =>
          (
            await host.db.query(
              sql<{
                body: string;
              }>`SELECT body FROM notes WHERE id = ${'bob-note'}`
            )
          )[0]?.body;
        try {
          receive({
            pushSeq: '2',
            checkpoint: '10',
            rows: { notes: [note('bob 10', 3300)] },
          });
          await flushPush();
          const before = host.snapshots();
          host.setSnapshot({
            status: 'ok',
            checkpoint: '10',
            hash: 'accepted-10',
            tables: { notes: [note('bob 10', 3300)] },
          });
          for (const hint of hints) {
            receive({
              pushSeq: '0',
              optimistic: true,
              tables: ['notes'],
              rows: {
                notes: [
                  {
                    ...note(
                      `${hint.writer} ${hint.revision}`,
                      3300 + hint.skew
                    ),
                    owner_id: hint.writer,
                  },
                ],
              },
            });
            await flushPush();
            expect(await body()).toBe('bob 10');
          }
          host.setSnapshot({
            status: 'ok',
            checkpoint: '11',
            hash: 'accepted-11',
            tables: { notes: [note('bob 11', 3300)] },
          });
          receive({
            pushSeq: '0',
            optimistic: true,
            tables: ['notes'],
            rows: { notes: [note('bob 11', 3300)] },
          });
          await flushPush();
          expect(host.snapshots()).toBeGreaterThan(before);
          expect(await body()).toBe('bob 11');
          receive({
            pushSeq: '0',
            optimistic: true,
            rows: { notes: [note('bob 4', 86_403_300)] },
          });
          await flushPush();
          expect(await body()).toBe('bob 11');
        } finally {
          await host.engine.disconnect();
          host.raw.close();
        }
      }
    )
  );
});
