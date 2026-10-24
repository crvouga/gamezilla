import { expect, test } from 'bun:test';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';
import type { MutationBatchResponse } from '@pkgs/sync-engine-shared-ts/v2';
import { noteRow, openFinalSavepoint } from './final-savepoint-fixture';

test('a single applied HTTP mutation commits without a separate final savepoint release', async () => {
  // regression: sync-final-applied-savepoint-release-round-trip
  const h = await openFinalSavepoint();
  try {
    const response = await h.send([noteRow('milk', 1)]);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ackSeq: 1,
      verdicts: [{ mutationId: 'change-1', status: 'applied' }],
    });
    expect(await h.notes()).toEqual([{ id: 'note-1', body: 'milk' }]);
    expect(await h.markers()).toEqual([
      { mutation_id: 'change-1', status: 'applied' },
    ]);
    expect(h.publications).toHaveLength(1);
    expect(
      h.statements.filter((text) => text === 'SAVEPOINT sync_engine_mutation')
    ).toHaveLength(1);
    expect(
      h.statements.filter(
        (text) => text === 'RELEASE SAVEPOINT sync_engine_mutation'
      )
    ).toEqual([]);
  } finally {
    await h.db.disconnect();
  }
});

for (const driver of ['sqlite', 'postgres'] as const) {
  test(`a mixed batch releases earlier and rejection savepoints, keeping only its final applied one (${driver})`, async () => {
    const h = await openFinalSavepoint(driver);
    try {
      const response = await h.send(
        ['milk', 'refused', 'bread'].map((body, i) => noteRow(body, i + 1))
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        ackSeq: 3,
        verdicts: [
          { status: 'applied' },
          { status: 'rejected', code: 'REFUSED' },
          { status: 'applied' },
        ],
      });
      expect(await h.notes()).toEqual([
        { id: 'note-1', body: 'milk' },
        { id: 'note-3', body: 'bread' },
      ]);
      expect(
        h.statements.filter((text) => text === 'SAVEPOINT sync_engine_mutation')
      ).toHaveLength(4);
      expect(
        h.statements.filter(
          (text) => text === 'RELEASE SAVEPOINT sync_engine_mutation'
        )
      ).toHaveLength(3);
      expect(
        h.statements.filter(
          (text) => text === 'ROLLBACK TO SAVEPOINT sync_engine_mutation'
        )
      ).toHaveLength(1);
      expect(h.maxDepth()).toBe(1);
      expect(await h.rejections()).toEqual([
        { mutation_id: 'change-2', code: 'REFUSED' },
      ]);
    } finally {
      await h.db.disconnect();
    }
  });

  test(`commit clears a live savepoint and a later rollback cannot undo committed work (${driver})`, async () => {
    const h = await openFinalSavepoint(driver);
    try {
      await h.db.transaction(async (tx) => {
        await tx.run(raw('SAVEPOINT retained_choice'));
        await tx.run(
          sql`INSERT INTO notes (id, body) VALUES (${'first'}, ${'kept'})`
        );
      });
      await expect(
        h.db.transaction(async (tx) => {
          await tx.run(raw('SAVEPOINT retained_choice'));
          await tx.run(
            sql`INSERT INTO notes (id, body) VALUES (${'second'}, ${'discarded'})`
          );
          throw new Error('Abort later transaction');
        })
      ).rejects.toThrow('Abort later transaction');
      expect(await h.notes()).toEqual([{ id: 'first', body: 'kept' }]);
    } finally {
      await h.db.disconnect();
    }
  });
}

test('a final duplicate, inline rejection and thrown refusal retain their releases across batches', async () => {
  const h = await openFinalSavepoint();
  try {
    await h.send([noteRow('milk', 1)]);
    h.statements.length = 0;
    expect((await h.send([noteRow('milk', 1)])).status).toBe(200);
    expect(
      h.statements.filter(
        (text) => text === 'RELEASE SAVEPOINT sync_engine_mutation'
      )
    ).toHaveLength(1);
    for (const row of [
      { ...noteRow('bad', 2), name: 'unknown' },
      { ...noteRow('bad', 3), args: '{' },
      { ...noteRow('bad', 4), args: JSON.stringify({ id: 5 }) },
    ]) {
      h.statements.length = 0;
      const response = await h.send([row]);
      const result = (await response.json()) as MutationBatchResponse;
      expect(result.verdicts[0]?.status).toBe('rejected');
      expect(
        h.statements.filter(
          (text) => text === 'RELEASE SAVEPOINT sync_engine_mutation'
        )
      ).toHaveLength(1);
    }
    h.statements.length = 0;
    const response = await h.send([noteRow('refused', 5)]);
    const result = (await response.json()) as MutationBatchResponse;
    expect(result.verdicts[0]?.status).toBe('rejected');
    expect(
      h.statements.filter(
        (text) => text === 'RELEASE SAVEPOINT sync_engine_mutation'
      )
    ).toHaveLength(2);
    expect(await h.notes()).toEqual([{ id: 'note-1', body: 'milk' }]);
    expect(h.maxDepth()).toBe(1);
  } finally {
    await h.db.disconnect();
  }
});
