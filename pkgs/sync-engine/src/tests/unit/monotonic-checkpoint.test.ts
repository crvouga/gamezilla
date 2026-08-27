import { describe, expect, test } from 'bun:test';

import { createMonotonicCheckpoint } from '../../shared/commit-checkpoint';

describe('createMonotonicCheckpoint', () => {
  test('advances with wall clock under normal time', () => {
    let now = 1_700_000_000_000;
    const next = createMonotonicCheckpoint(() => now);
    const a = next();
    now += 100;
    const b = next();
    expect(BigInt(b) > BigInt(a)).toBe(true);
  });

  test('stays strictly increasing when wall clock jumps backwards', () => {
    let now = 1_700_000_000_000;
    const next = createMonotonicCheckpoint(() => now);
    const before = next();
    now -= 60_000;
    const after = next();
    expect(BigInt(after) > BigInt(before)).toBe(true);
    expect(after).toBe(String(BigInt(before) + 1n));
  });
});
