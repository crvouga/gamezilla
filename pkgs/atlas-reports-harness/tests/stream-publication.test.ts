import { expect, test } from 'bun:test';
import { eachLimitedStream } from '@crvouga/atlas-reports/completion-order';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

async function after(hops: number): Promise<void> {
  for (let n = 0; n < hops; n += 1) await Promise.resolve();
}

test('lazy publication visits every input exactly once with bounded in-flight work', async () => {
  await assertProperty(
    'stream publication is complete and bounded',
    fc.asyncProperty(
      fc.array(fc.nat({ max: 20 }), { maxLength: 30 }),
      fc.integer({ min: 1, max: 6 }),
      async (latencies, limit) => {
        let live = 0;
        let peak = 0;
        const seen: number[] = [];
        async function* input() {
          yield* latencies.keys();
        }
        await eachLimitedStream(input(), limit, async (id) => {
          live += 1;
          peak = Math.max(peak, live);
          await after(latencies[id]!);
          seen.push(id);
          live -= 1;
        });
        expect(peak).toBeLessThanOrEqual(limit);
        expect(live).toBe(0);
        expect(seen.sort((a, b) => a - b)).toEqual([...latencies.keys()]);
      }
    )
  );
});

test('an upload failure drains its active siblings before returning the error', async () => {
  let live = 0;
  async function* input() {
    yield* [0, 1, 2];
  }
  const publication = eachLimitedStream(input(), 2, async (id) => {
    live += 1;
    await after(id === 0 ? 20 : 0);
    live -= 1;
    if (id === 1) throw new Error('upload unavailable');
  });
  await expect(publication).rejects.toThrow('upload unavailable');
  expect(live).toBe(0);
});

test('an input failure drains already-started uploads before returning the error', async () => {
  let completed = false;
  async function* input() {
    yield 0;
    throw new Error('input unavailable');
  }
  const publication = eachLimitedStream(input(), 4, async () => {
    await after(20);
    completed = true;
  });
  await expect(publication).rejects.toThrow('input unavailable');
  expect(completed).toBe(true);
});
