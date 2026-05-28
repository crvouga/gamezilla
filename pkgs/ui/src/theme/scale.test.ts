import { describe, expect, test } from 'bun:test';
import { PALETTE } from './colors/color-palette';
import {
  borderRadius,
  elevation,
  makeElevation,
  type ElevationLevel,
} from './scale';

const LEVELS: ReadonlyArray<ElevationLevel> = [0, 1, 2, 3, 4, 5];

function extractAlphas(boxShadow: string | undefined): number[] {
  if (!boxShadow) return [];
  const out: number[] = [];
  const re =
    /(?:rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+|hsla\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%)\s*,\s*([\d.]+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(boxShadow)) !== null) {
    out.push(Number(m[1]));
  }
  return out;
}

function maxAlpha(boxShadow: string | undefined): number {
  const alphas = extractAlphas(boxShadow);
  return alphas.length > 0 ? Math.max(...alphas) : 0;
}

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

  test('levels 1-5 return boxShadow + android elevation', () => {
    for (const level of LEVELS) {
      if (level === 0) continue;
      const light = lightElev(level);
      expect(typeof light.boxShadow).toBe('string');
      expect((light.boxShadow as string).length).toBeGreaterThan(0);
      expect(typeof light.elevation).toBe('number');
      expect(light.elevation as number).toBeGreaterThan(0);
    }
  });

  test('android elevation is monotonically increasing across levels', () => {
    let prev = -1;
    for (const level of LEVELS) {
      const cur = lightElev(level).elevation ?? 0;
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });

  test('shadow alpha is monotonically increasing across levels', () => {
    let prev = -1;
    for (const level of LEVELS) {
      const cur = maxAlpha(lightElev(level).boxShadow);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
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

describe('legacy elevation()', () => {
  test('level 0 returns empty, other levels return shadow', () => {
    expect(elevation(0)).toEqual({});
    for (const level of LEVELS) {
      if (level === 0) continue;
      const style = elevation(level);
      expect(typeof style.boxShadow).toBe('string');
      expect(typeof style.elevation).toBe('number');
    }
  });
});
