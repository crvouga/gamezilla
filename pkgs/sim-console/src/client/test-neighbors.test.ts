import { describe, expect, test } from 'bun:test';

import { resolveTestNeighbor } from './test-neighbors';

const TESTS = [
  { testId: 'zeta-last' },
  { testId: 'alpha-first' },
  { testId: 'mu-mid' },
];

describe('resolveTestNeighbor', () => {
  test('orders by testId and returns both neighbors', () => {
    expect(resolveTestNeighbor(TESTS, 'mu-mid')).toEqual({
      prev: 'alpha-first',
      next: 'zeta-last',
      index: 1,
      total: 3,
    });
  });

  test('disables prev on the first test', () => {
    expect(resolveTestNeighbor(TESTS, 'alpha-first')).toEqual({
      prev: null,
      next: 'mu-mid',
      index: 0,
      total: 3,
    });
  });

  test('disables next on the last test', () => {
    expect(resolveTestNeighbor(TESTS, 'zeta-last')).toEqual({
      prev: 'mu-mid',
      next: null,
      index: 2,
      total: 3,
    });
  });

  test('returns no neighbors for an unknown id', () => {
    expect(resolveTestNeighbor(TESTS, 'missing')).toEqual({
      prev: null,
      next: null,
      index: -1,
      total: 3,
    });
  });

  test('handles a single test', () => {
    expect(resolveTestNeighbor([{ testId: 'only' }], 'only')).toEqual({
      prev: null,
      next: null,
      index: 0,
      total: 1,
    });
  });
});
