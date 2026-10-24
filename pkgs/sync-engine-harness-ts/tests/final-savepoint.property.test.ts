import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { MutationBatchResponse } from '@pkgs/sync-engine-shared-ts/v2';
import fc from 'fast-check';
import { noteRow, openFinalSavepoint } from './final-savepoint-fixture';

test('batch failures at every replay position leave no partial rows and retries retain stable outcomes', async () => {
  await assertProperty(
    'final savepoint preserves batch outcomes',
    fc.asyncProperty(
      fc.array(fc.boolean(), { minLength: 1, maxLength: 6 }),
      fc.nat(20),
      async (refused, position) => {
        const h = await openFinalSavepoint();
        try {
          const rows = refused.map((reject, index) =>
            noteRow(reject ? 'refused' : `accepted-${index}`, index + 1)
          );
          const faultAt = position % (rows.length + 1);
          h.arm('observability', faultAt + 1);
          const first = await h.send(rows);
          if (faultAt < rows.length) {
            expect(first.status).toBe(503);
            expect(await h.notes()).toEqual([]);
            expect(await h.markers()).toEqual([]);
            expect(await h.rejections()).toEqual([]);
            expect(await h.observations()).toEqual([]);
            expect(h.publications).toEqual([]);
          } else expect(first.status).toBe(200);
          h.arm('none');
          const expected = refused.map((reject) =>
            reject ? 'rejected' : 'applied'
          );
          const retry = await h.send(rows);
          expect(retry.status).toBe(200);
          const result = (await retry.json()) as MutationBatchResponse;
          expect(result.verdicts.map((verdict) => verdict.status)).toEqual(
            expected
          );
          expect(await h.notes()).toEqual(
            refused.flatMap((reject, index) =>
              reject
                ? []
                : [{ id: `note-${index + 1}`, body: `accepted-${index}` }]
            )
          );
          expect((await h.markers()).map((m) => m.status)).toEqual(expected);
          expect(await h.rejections()).toHaveLength(
            refused.filter(Boolean).length
          );
          expect(await h.observations()).toHaveLength(rows.length);
          expect(h.maxDepth()).toBe(1);
        } finally {
          await h.db.disconnect();
        }
      }
    )
  );
});
