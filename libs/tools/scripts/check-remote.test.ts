import { describe, expect, test } from 'bun:test';

import { findNewRun } from './check-remote';

describe('findNewRun', () => {
  const runs = [
    { databaseId: 3, headSha: 'other' },
    { databaseId: 2, headSha: 'abc' },
    { databaseId: 1, headSha: 'abc' },
  ];

  test('picks the run created after the snapshot on our commit', () => {
    expect(findNewRun(runs, new Set([1]), 'abc')?.databaseId).toBe(2);
  });

  test('ignores runs that already existed or are on another commit', () => {
    expect(findNewRun(runs, new Set([1, 2]), 'abc')).toBeUndefined();
  });
});
