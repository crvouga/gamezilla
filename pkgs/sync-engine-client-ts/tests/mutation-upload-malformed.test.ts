import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationUploadResult } from '@pkgs/sync-engine-client-ts/mutation-upload-queue';
import fc from 'fast-check';
import { applied, drain, queueWith } from './mutation-upload-fixture';

type Fault = 'status' | 'duplicate' | 'missing' | 'foreign' | 'refusal';

async function recover(fault: Fault, size: number, index: number) {
  const db = await queueWith(
    Array.from({ length: size }, (_, n) => JSON.stringify({ n }))
  );
  let calls = 0;
  try {
    const result = await drain(db, async (rows) => {
      calls += 1;
      // The first malformed answer must not retire ANY queued work.
      expect(rows.map((row) => row.id)).toEqual(
        Array.from({ length: size }, (_, n) => `m-${n + 1}`)
      );
      if (calls > 1) return applied(rows);
      const good = applied(rows);
      const verdicts: unknown[] = [...good.verdicts];
      if (fault === 'status')
        verdicts[index] = { mutationId: rows[index]!.id, status: 'pending' };
      if (fault === 'duplicate')
        verdicts[index] = good.verdicts[(index + 1) % size];
      if (fault === 'missing') verdicts.pop();
      if (fault === 'foreign')
        verdicts[index] = { mutationId: 'foreign', status: 'applied' };
      if (fault === 'refusal')
        verdicts[index] = { mutationId: rows[index]!.id, status: 'rejected' };
      return { ...good, verdicts } as MutationUploadResult;
    });
    expect(calls).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.refused).toEqual([]);
    expect(
      await db.query(
        sql<{
          id: string;
        }>`SELECT id FROM sync_engine_mutations WHERE deleted_at IS NULL`
      )
    ).toEqual([]);
  } finally {
    await db.disconnect();
  }
}

// regression: malformed-mutation-verdict-retires-work
test('an unknown status cannot retire m-1 before a valid acknowledgement', async () => {
  await recover('status', 2, 0);
});

test('malformed batch verdicts preserve every queued write until a complete retry', async () => {
  await assertProperty(
    'malformed mutation verdicts cannot partially acknowledge durable work',
    fc.asyncProperty(
      fc.constantFrom<Fault>(
        'status',
        'duplicate',
        'missing',
        'foreign',
        'refusal'
      ),
      fc.integer({ min: 2, max: 4 }),
      fc.nat({ max: 3 }),
      async (fault, size, position) => recover(fault, size, position % size)
    )
  );
});
