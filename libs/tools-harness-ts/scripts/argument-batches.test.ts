import { expect, test } from 'bun:test';
import { ARGUMENT_BUDGET, argumentBatches } from './argument-batches';

test('a path list over the Windows command-line cap splits into batches under it', () => {
  // regression: root-lint-command-line-too-long
  const paths = Array.from(
    { length: 900 },
    (_, i) => `.claude/skills/some-skill/references/file-${i}.md`
  );
  const batches = argumentBatches(paths);
  expect(batches.length).toBeGreaterThan(1);
  expect(batches.flat()).toEqual(paths);
  for (const batch of batches) {
    expect(batch.join(' ').length).toBeLessThan(ARGUMENT_BUDGET);
  }
  expect(ARGUMENT_BUDGET).toBeLessThan(32_767 / 2);
});

test('batches keep order, isolate an oversized argument and drop nothing', () => {
  expect(argumentBatches([], 10)).toEqual([]);
  expect(argumentBatches(['a', 'b', 'c'], 8)).toEqual([['a', 'b'], ['c']]);
  expect(argumentBatches(['a', 'x'.repeat(20), 'b'], 8)).toEqual([
    ['a'],
    ['x'.repeat(20)],
    ['b'],
  ]);
});
