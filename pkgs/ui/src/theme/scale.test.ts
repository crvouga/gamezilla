import { describe, expect, test } from 'bun:test';
import { PALETTE } from './colors/color-palette';
import { borderRadius, type ElevationLevel, makeElevation } from './scale';

const LEVELS: ReadonlyArray<ElevationLevel> = [0, 1, 2, 3, 4, 5];

describe('borderRadius scale', () => {
  test('keys form an ascending scale', () => {
    expect(borderRadius.none).toBe(0);
    expect(borderRadius.xs).toBeLessThan(borderRadius.sm);
    expect(borderRadius.sm).toBeLessThan(borderRadius.md);
    expect(borderRadius.md).toBeLessThan(borderRadius.lg);
    expect(borderRadius.lg).toBeLessThan(borderRadius.xl);
    expect(borderRadius.xl).toBeLessThan(borderRadius['2xl']);
    expect(borderRadius.full).toBeGreaterThan(borderRadius['2xl']);
  });
});

describe('makeElevation', () => {
  const lightElev = makeElevation(PALETTE.light, 'light');
  const darkElev = makeElevation(PALETTE.dark, 'dark');

  test('level 0 returns empty style in both schemes', () => {
    expect(lightElev(0)).toEqual({});
    expect(darkElev(0)).toEqual({});
  });

  test('levels 1-5 never emit boxShadow or android elevation', () => {
    for (const level of LEVELS) {
      if (level === 0) continue;
      expect(lightElev(level).boxShadow).toBeUndefined();
      expect(lightElev(level).elevation).toBeUndefined();
      expect(darkElev(level).boxShadow).toBeUndefined();
      expect(darkElev(level).elevation).toBeUndefined();
    }
  });

  test('light scheme never returns a backgroundColor lift', () => {
    for (const level of LEVELS) {
      expect(lightElev(level).backgroundColor).toBeUndefined();
    }
  });

  test('dark scheme returns surface lift for levels >= 1', () => {
    expect(darkElev(0).backgroundColor).toBeUndefined();
    for (const level of LEVELS) {
      if (level === 0) continue;
      const bg = darkElev(level).backgroundColor;
      expect(bg).toBeDefined();
      expect(typeof bg).toBe('string');
    }
  });

  test('dark scheme uses progressively higher surface tiers', () => {
    const tiers = new Set<string>();
    for (const level of LEVELS) {
      if (level === 0) continue;
      const bg = darkElev(level).backgroundColor as string;
      tiers.add(bg);
    }
    // At least two distinct surface tiers should be in play (surface ->
    // surfaceElevated -> surfaceOverlay).
    expect(tiers.size).toBeGreaterThanOrEqual(2);
  });
});
