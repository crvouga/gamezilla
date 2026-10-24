import { expect, test } from 'bun:test';
import { pendingNote } from '@pkgs/sync-engine-harness-ts/mutations';
import { processMutationsBatch } from '@pkgs/sync-engine-server-ts/process-mutations-batch';
import { mutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-registry';
import {
  AUTH,
  NOW,
  noteRow,
  openFinalSavepoint,
} from './final-savepoint-fixture';

for (const driver of ['sqlite', 'postgres'] as const)
  for (const stage of ['observability', 'fanout'] as const)
    test(`late ${stage} failure rolls the entire HTTP batch back before acknowledgement (${driver})`, async () => {
      const h = await openFinalSavepoint(driver);
      try {
        h.arm(stage, stage === 'observability' ? 2 : 1);
        const rows = [noteRow('milk', 1), noteRow('bread', 2)];
        expect((await h.send(rows)).status).toBe(503);
        expect(await h.notes()).toEqual([]);
        expect(await h.markers()).toEqual([]);
        expect(await h.rejections()).toEqual([]);
        expect(await h.observations()).toEqual([]);
        expect(h.publications).toEqual([]);
        h.arm('none');
        expect((await h.send(rows)).status).toBe(200);
        expect((await h.notes()).map((row) => row.body)).toEqual([
          'milk',
          'bread',
        ]);
        expect(await h.observations()).toHaveLength(2);
        expect(h.maxDepth()).toBe(1);
      } finally {
        await h.db.disconnect();
      }
    });

test('a fault after the final replay rolls back its retained savepoint with the outer batch', async () => {
  const h = await openFinalSavepoint();
  let id = 0;
  try {
    await expect(
      h.db.transaction((transaction) =>
        processMutationsBatch({
          transaction,
          registry: mutationRegistry([pendingNote]),
          auth: AUTH,
          mutations: [noteRow('milk', 1), noteRow('bread', 2)],
          now: () => NOW,
          createId: () => `id-${++id}`,
          onAfterMutation: (index) => {
            if (index === 1) throw new Error('Final replay boundary fault');
          },
        })
      )
    ).rejects.toThrow('Final replay boundary fault');
    expect(await h.notes()).toEqual([]);
    expect(await h.markers()).toEqual([]);
    expect(await h.observations()).toEqual([]);
    expect(h.maxDepth()).toBe(1);
  } finally {
    await h.db.disconnect();
  }
});
