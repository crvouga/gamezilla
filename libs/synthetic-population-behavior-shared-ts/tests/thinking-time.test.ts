import { expect, test } from 'bun:test';
import { drawThinkingMs } from '@libs/synthetic-population-behavior-shared-ts/thinking-time';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const bounds = fc
  .tuple(
    fc.integer({ min: 2_000, max: 20_000 }),
    fc.integer({ min: 2_000, max: 20_000 })
  )
  .map(([a, b]) => ({ minMs: Math.min(a, b), maxMs: Math.max(a, b) }));

test('every thinking time is 2 to 20 seconds and never repeats the previous whole second', () => {
  assertProperty(
    'thinking time',
    fc.property(
      bounds,
      fc.option(fc.integer({ min: 0, max: 30_000 }), { nil: null }),
      fc.infiniteStream(
        fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true })
      ),
      (limits, previous, draws) => {
        const random = () => draws.next().value as number;
        const ms = drawThinkingMs(limits, previous, random);
        expect(ms).toBeGreaterThanOrEqual(2_000);
        expect(ms).toBeLessThan(20_000);
        if (previous !== null)
          expect(Math.floor(ms / 1000)).not.toBe(Math.floor(previous / 1000));
      }
    )
  );
});

test('a draw that would repeat the previous second moves to another', () => {
  // Bounds 6 to 7 seconds, a draw that would land on 6: the previous move took 6.
  const ms = drawThinkingMs({ minMs: 6_000, maxMs: 7_999 }, 6_200, () => 0);
  expect(Math.floor(ms / 1000)).toBe(7);
});
