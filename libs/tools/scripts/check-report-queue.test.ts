import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { restoreReportQueue } from './check-report-queue';

// regression: ci-report-restore-aborts-independent-outputs
test('a missing chess artifact cannot abandon queued friends reports', async () => {
  const ids = [
    '@libs/chess#test:spec:13',
    ...Array.from(
      { length: 60 },
      (_, part) => `@libs/friends#test:spec:${part}`
    ),
  ];
  const attempted: string[] = [];
  const failure = new Error(
    'Report cache restore @libs/chess#test:spec:13: HTTP 404'
  );
  let verdict: unknown;
  try {
    await restoreReportQueue(ids, async (id) => {
      attempted.push(id);
      if (id === ids[0]) throw failure;
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  } catch (error) {
    verdict = error;
  }
  expect([...attempted].sort()).toEqual([...ids].sort());
  expect(verdict).toBeInstanceOf(AggregateError);
  expect((verdict as AggregateError).errors).toEqual([failure]);
});

test('each restoration is attempted once and every failure contributes to the verdict', async () => {
  await assertProperty(
    'report-restoration-independent-failures',
    fc.asyncProperty(
      fc.array(fc.boolean(), { maxLength: 80 }),
      async (fails) => {
        const ids = fails.map((_, index) => String(index));
        const attempted: string[] = [];
        let active = 0;
        let peak = 0;
        let verdict: unknown;
        try {
          await restoreReportQueue(ids, async (id) => {
            attempted.push(id);
            peak = Math.max(peak, ++active);
            await Promise.resolve();
            active--;
            if (fails[Number(id)]) throw new Error(id);
          });
        } catch (error) {
          verdict = error;
        }
        expect([...attempted].sort()).toEqual([...ids].sort());
        expect(active).toBe(0);
        expect(peak).toBeLessThanOrEqual(16);
        const failures = ids.filter((id) => fails[Number(id)]);
        if (failures.length === 0) expect(verdict).toBeUndefined();
        else {
          expect(verdict).toBeInstanceOf(AggregateError);
          expect(
            (verdict as AggregateError).errors
              .map((error: Error) => error.message)
              .sort()
          ).toEqual(failures.sort());
        }
      }
    )
  );
});
