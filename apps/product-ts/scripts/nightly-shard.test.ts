import { expect, test } from 'bun:test';
import {
  formatShard,
  NIGHTLY_SHARD_ENV,
  nightlyShard,
  shareOf,
  WHOLE_SUITE,
} from './nightly-shard';

test('no shard is the whole suite, and a named one is its 1-based place', () => {
  expect(nightlyShard({})).toEqual(WHOLE_SUITE);
  expect(nightlyShard({ [NIGHTLY_SHARD_ENV]: ' ' })).toEqual(WHOLE_SUITE);
  expect(nightlyShard({ [NIGHTLY_SHARD_ENV]: '3/6' })).toEqual({
    index: 2,
    count: 6,
  });
  expect(formatShard(nightlyShard({ [NIGHTLY_SHARD_ENV]: '6/6' }))).toBe('6/6');
  for (const bad of ['0/6', '7/6', '3', 'a/b', '1/0'])
    expect(() => nightlyShard({ [NIGHTLY_SHARD_ENV]: bad }), bad).toThrow(
      'is not a shard'
    );
});

test('the shards of a suite run every file exactly once, neighbours apart', () => {
  const files = Array.from({ length: 23 }, (_, index) => `file-${index}`);
  const count = 6;
  const shares = Array.from({ length: count }, (_, index) =>
    shareOf(files, { index, count })
  );
  expect(shares.flat().toSorted()).toEqual(files.toSorted());
  // One package's files sit together in the sorted list; no shard takes two
  // neighbours, so a slow package spreads over every runner.
  for (const share of shares)
    for (const file of share)
      expect(share).not.toContain(files[files.indexOf(file) + 1]);
  expect(shareOf(files, WHOLE_SUITE)).toEqual(files);
});
