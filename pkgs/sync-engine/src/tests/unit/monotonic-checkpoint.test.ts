import { describe, expect, test } from 'bun:test';

import { createMonotonicCheckpoint } from '../../shared/commit-checkpoint';

describe('createMonotonicCheckpoint', () => {
  test('advances with wall clock under normal time', () => {
    let now = 1_700_000_000_000;
    const alloc = createMonotonicCheckpoint(() => now);
    const a = alloc.next();
    now += 100;
    const b = alloc.next();
    expect(BigInt(b) > BigInt(a)).toBe(true);
  });

  test('stays strictly increasing when wall clock jumps backwards', () => {
    let now = 1_700_000_000_000;
    const alloc = createMonotonicCheckpoint(() => now);
    const before = alloc.next();
    now -= 60_000;
    const after = alloc.next();
    expect(BigInt(after) > BigInt(before)).toBe(true);
    expect(after).toBe(String(BigInt(before) + 1n));
  });

  test('initialLast floors a remake after forward clock skew', () => {
    const floor = 1_700_000_060_000_999_999n;
    const now = 1_700_000_000_000;
    const alloc = createMonotonicCheckpoint(() => now, {
      initialLast: floor,
    });
    expect(BigInt(alloc.next())).toBe(floor + 1n);
    expect(alloc.highWater()).toBe(floor + 1n);
  });
});
