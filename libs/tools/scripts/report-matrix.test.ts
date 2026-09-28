import { describe, expect, test } from 'bun:test';

import { partIndexes } from './report-matrix';

describe('partIndexes', () => {
  test('one shard per part of the widest suite', () => {
    expect(partIndexes([1, 5, 3])).toEqual([0, 1, 2, 3, 4]);
  });

  test('no spec suites, no shards', () => {
    expect(partIndexes([])).toEqual([]);
  });
});
