import { describe, expect, test } from 'bun:test';

import {
  compareCheckpoint,
  isContiguousNext,
  isLegacyWallClockCheckpoint,
} from './push-applied';

describe('isLegacyWallClockCheckpoint', () => {
  test('detects Date.now*1e6 style values', () => {
    expect(isLegacyWallClockCheckpoint('1786099140002000000')).toBe(true);
    expect(isLegacyWallClockCheckpoint('1000000000000000')).toBe(true);
  });

  test('rejects monotonic allocate values', () => {
    expect(isLegacyWallClockCheckpoint('1')).toBe(false);
    expect(isLegacyWallClockCheckpoint('96')).toBe(false);
    expect(isLegacyWallClockCheckpoint('999999')).toBe(false);
  });
});

describe('isContiguousNext', () => {
  test('unknown baseline allows apply (row-gated by caller)', () => {
    expect(isContiguousNext(null, '1')).toBe(true);
    expect(isContiguousNext(null, '96')).toBe(true);
  });

  test('legacy wall-clock baseline is treated as unknown', () => {
    expect(isContiguousNext('1786099140002000000', '1')).toBe(true);
    expect(isContiguousNext('1786099140002000000', '96')).toBe(true);
  });

  test('exact next from known baseline', () => {
    expect(isContiguousNext('1', '2')).toBe(true);
    expect(isContiguousNext('41', '42')).toBe(true);
    expect(isContiguousNext('1', '1')).toBe(false);
    expect(isContiguousNext('1', '3')).toBe(false);
  });
});

describe('compareCheckpoint', () => {
  test('compares large integer strings as bigints', () => {
    expect(compareCheckpoint('9', '10')).toBeLessThan(0);
    expect(compareCheckpoint('10', '9')).toBeGreaterThan(0);
    expect(compareCheckpoint('42', '42')).toBe(0);
  });
});
