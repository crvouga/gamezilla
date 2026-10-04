import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
// regression: ui-quality-harness-source-resolution — fresh shards have no dist/harness.js; the public import must resolve source.
import { WindowScorer } from '@pkgs/ui-quality-check-server/window-scorer';

function image(top: number) {
  const data = new Uint8Array(224 * 448 * 3).fill(40);
  data.fill(top, 0, 100 * 224 * 3);
  return { width: 224, height: 448, data };
}

function inference() {
  const batches: number[] = [];
  return {
    batches,
    async run(tensors: readonly Float32Array[]) {
      batches.push(tensors.length);
      return Float32Array.from(
        { length: tensors.length * 512 },
        (_, i) => tensors[Math.floor(i / 512)]![i % 512]!
      );
    },
  };
}

test('repeated windows retain their contribution without repeating inference', async () => {
  // regression: ui-quality-repeated-window-inference — 224×448 frames differ only in the first 100 rows; their bottom window is identical.
  const model = inference();
  const scorer = new WindowScorer(model.run, 16);
  const first = await scorer.score([image(80), image(120)]);
  expect(model.batches.reduce((a, b) => a + b, 0)).toBe(3);
  const repeated = await scorer.score([image(80), image(120)]);
  expect(repeated).toEqual(first);
  expect(model.batches.reduce((a, b) => a + b, 0)).toBe(3);
  for (const [i, input] of [image(80), image(120)].entries()) {
    const independent = new WindowScorer(inference().run, 16);
    expect(first[i]).toEqual((await independent.score([input]))[0]);
  }
});

test('duplicates within a batch are inferred once and every window contributes', async () => {
  const model = inference();
  const scorer = new WindowScorer(model.run, 16);
  const [actual] = await scorer.score([image(40), image(40)]);
  expect(model.batches).toEqual([1]);
  const normalized = (40 / 255 - 0.48145466) / 0.26862954;
  expect(actual![0]).toBe(Math.fround(normalized) * 2);
});

test('eviction bounds memory without changing scores when a window returns', async () => {
  const model = inference();
  const scorer = new WindowScorer(model.run, 2, 1);
  const first = await scorer.score([image(80)]);
  await scorer.score([image(120)]);
  const returned = await scorer.score([image(80)]);
  expect(returned).toEqual(first);
  expect(model.batches.reduce((a, b) => a + b, 0)).toBe(5);
  scorer.clear();
  await scorer.score([image(40)]);
  expect(model.batches.reduce((a, b) => a + b, 0)).toBe(6);
});

test('an inference failure does not cache missing embeddings', async () => {
  const model = inference();
  let fail = true;
  const scorer = new WindowScorer(async (tensors) => {
    if (fail) throw new Error('inference failed');
    return model.run(tensors);
  }, 16);
  await expect(scorer.score([image(80)])).rejects.toThrow('inference failed');
  fail = false;
  expect(await scorer.score([image(80)])).toHaveLength(1);
  expect(model.batches).toEqual([2]);
});

test('window scores are independent of reuse, eviction and inference batch size', async () => {
  await assertProperty(
    'window embeddings preserve all image scores',
    fc.asyncProperty(
      fc.array(fc.integer({ min: 0, max: 255 }), {
        minLength: 1,
        maxLength: 8,
      }),
      fc.integer({ min: 1, max: 4 }),
      fc.integer({ min: 1, max: 4 }),
      async (tops, batchSize, capacity) => {
        const scorer = new WindowScorer(inference().run, batchSize, capacity);
        const expected = await Promise.all(
          tops.map(
            async (top) =>
              (
                await new WindowScorer(inference().run, 16).score([image(top)])
              )[0]!
          )
        );
        const inputs = tops.map(image);
        expect(await scorer.score(inputs)).toEqual(expected);
        expect(await scorer.score(inputs)).toEqual(expected);
      }
    )
  );
});

test('invalid embeddings and cancellation cannot seed the window cache', async () => {
  const malformed = new WindowScorer(async () => new Float32Array(1), 16);
  await expect(malformed.score([image(40)])).rejects.toThrow('embedding shape');
  const controller = new AbortController();
  const model = inference();
  const scorer = new WindowScorer(async (tensors) => {
    controller.abort(new Error('cancel inference'));
    return model.run(tensors);
  }, 16);
  await expect(scorer.score([image(40)], controller.signal)).rejects.toThrow(
    'cancel inference'
  );
  expect(await scorer.score([image(40)])).toHaveLength(1);
  expect(model.batches).toEqual([1, 1]);
});

test('window cache construction rejects limits that cannot finish', () => {
  expect(() => new WindowScorer(inference().run, 0)).toThrow('batch size');
  expect(() => new WindowScorer(inference().run, 16, -1)).toThrow('capacity');
});
