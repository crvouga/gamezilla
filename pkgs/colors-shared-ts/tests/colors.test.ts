import { describe, expect, test } from 'bun:test';

import {
  hslaToRgba,
  hslToRgb,
  rgbaToHsla,
  rgbToHsl,
} from '@pkgs/colors-shared-ts/convert';
import {
  contrastRatio,
  relativeLuminance,
} from '@pkgs/colors-shared-ts/luminance';
import { adjustLightness, mix, setAlpha } from '@pkgs/colors-shared-ts/ops';
import { hsl, hsla, rgb, rgba } from '@pkgs/colors-shared-ts/types';

const EPS = 1e-6;

function expectRgbClose(
  actual: { r: number; g: number; b: number },
  expected: { r: number; g: number; b: number },
  precision = 5
): void {
  expect(actual.r).toBeCloseTo(expected.r, precision);
  expect(actual.g).toBeCloseTo(expected.g, precision);
  expect(actual.b).toBeCloseTo(expected.b, precision);
}

function expectHslClose(
  actual: { h: number; s: number; l: number },
  expected: { h: number; s: number; l: number },
  precision = 5
): void {
  expect(actual.h).toBeCloseTo(expected.h, precision);
  expect(actual.s).toBeCloseTo(expected.s, precision);
  expect(actual.l).toBeCloseTo(expected.l, precision);
}

describe('constructors clamp channels', () => {
  test('rgb clamps to [0, 1]', () => {
    expect(rgb(-0.5, 1.5, 0.25)).toEqual({ r: 0, g: 1, b: 0.25 });
  });

  test('hsla wraps hue and clamps s/l/a', () => {
    const c = hsla(400, 1.2, -0.1, 2);
    expect(c.h).toBeCloseTo(40, 5);
    expect(c.s).toBe(1);
    expect(c.l).toBe(0);
    expect(c.a).toBe(1);
  });
});

describe('rgb ↔ hsl conversion', () => {
  test('primaries', () => {
    expectHslClose(rgbToHsl(rgb(1, 0, 0)), { h: 0, s: 1, l: 0.5 });
    expectHslClose(rgbToHsl(rgb(0, 1, 0)), { h: 120, s: 1, l: 0.5 });
    expectHslClose(rgbToHsl(rgb(0, 0, 1)), { h: 240, s: 1, l: 0.5 });
  });

  test('grays have zero saturation', () => {
    expectHslClose(rgbToHsl(rgb(0.5, 0.5, 0.5)), { h: 0, s: 0, l: 0.5 });
    expectHslClose(rgbToHsl(rgb(0, 0, 0)), { h: 0, s: 0, l: 0 });
    expectHslClose(rgbToHsl(rgb(1, 1, 1)), { h: 0, s: 0, l: 1 });
  });

  test('hsl → rgb primaries', () => {
    expectRgbClose(hslToRgb(hsl(0, 1, 0.5)), { r: 1, g: 0, b: 0 });
    expectRgbClose(hslToRgb(hsl(120, 1, 0.5)), { r: 0, g: 1, b: 0 });
    expectRgbClose(hslToRgb(hsl(240, 1, 0.5)), { r: 0, g: 0, b: 1 });
  });

  test('round-trip rgb → hsl → rgb', () => {
    const fixtures = [
      rgb(1, 0, 0),
      rgb(0, 1, 0),
      rgb(0, 0, 1),
      rgb(0, 0, 0),
      rgb(1, 1, 1),
      rgb(0.2, 0.4, 0.6),
      rgb(0.85, 0.12, 0.45),
    ];
    for (const c of fixtures) {
      expectRgbClose(hslToRgb(rgbToHsl(c)), c, 5);
    }
  });

  test('round-trip rgba ↔ hsla preserves alpha', () => {
    const c = rgba(0.2, 0.5, 0.8, 0.4);
    const back = hslaToRgba(rgbaToHsla(c));
    expectRgbClose(back, c, 5);
    expect(back.a).toBeCloseTo(0.4, 5);
  });
});

describe('adjustLightness', () => {
  test('darkens and lightens', () => {
    const base = rgba(0.5, 0.2, 0.8, 1);
    const darker = adjustLightness(base, -0.1);
    const lighter = adjustLightness(base, 0.1);
    expect(rgbaToHsla(darker).l).toBeLessThan(rgbaToHsla(base).l);
    expect(rgbaToHsla(lighter).l).toBeGreaterThan(rgbaToHsla(base).l);
  });

  test('clamps at 0 and 1', () => {
    const mid = rgba(0.5, 0.5, 0.5, 0.7);
    expect(rgbaToHsla(adjustLightness(mid, -1)).l).toBe(0);
    expect(rgbaToHsla(adjustLightness(mid, 1)).l).toBe(1);
  });

  test('preserves hue, saturation, alpha', () => {
    const base = rgba(0.3, 0.6, 0.9, 0.55);
    const before = rgbaToHsla(base);
    const after = rgbaToHsla(adjustLightness(base, -0.05));
    expect(after.h).toBeCloseTo(before.h, 4);
    expect(after.s).toBeCloseTo(before.s, 4);
    expect(after.a).toBeCloseTo(before.a, 5);
  });
});

describe('setAlpha', () => {
  test('sets and clamps alpha', () => {
    const c = rgba(0.1, 0.2, 0.3, 1);
    expect(setAlpha(c, 0.4).a).toBeCloseTo(0.4, 5);
    expect(setAlpha(c, -1).a).toBe(0);
    expect(setAlpha(c, 2).a).toBe(1);
  });

  test('preserves rgb channels', () => {
    const c = rgba(0.1, 0.2, 0.3, 1);
    const next = setAlpha(c, 0.5);
    expectRgbClose(next, c);
  });
});

describe('mix', () => {
  test('t=0 returns a, t=1 returns b', () => {
    const a = rgba(1, 0, 0, 1);
    const b = rgba(0, 0, 1, 0.5);
    expect(mix(a, b, 0)).toEqual(a);
    expect(mix(a, b, 1)).toEqual(b);
  });

  test('midpoint averages channels', () => {
    const a = rgba(0, 0, 0, 0);
    const b = rgba(1, 1, 1, 1);
    const mid = mix(a, b, 0.5);
    expectRgbClose(mid, { r: 0.5, g: 0.5, b: 0.5 });
    expect(mid.a).toBeCloseTo(0.5, 5);
  });

  test('clamps t outside [0, 1]', () => {
    const a = rgba(1, 0, 0, 1);
    const b = rgba(0, 1, 0, 1);
    expect(mix(a, b, -1)).toEqual(a);
    expect(mix(a, b, 2)).toEqual(b);
  });
});

describe('luminance + contrast', () => {
  test('luminance endpoints', () => {
    expect(relativeLuminance(rgb(0, 0, 0))).toBeCloseTo(0, 5);
    expect(relativeLuminance(rgb(1, 1, 1))).toBeCloseTo(1, 5);
  });

  test('white vs black is 21:1', () => {
    expect(contrastRatio(rgb(1, 1, 1), rgb(0, 0, 0))).toBeCloseTo(21, 1);
  });

  test('contrast is symmetric', () => {
    const a = rgb(1, 1, 1);
    const b = rgb(0.11, 0.3, 0.85);
    expect(Math.abs(contrastRatio(a, b) - contrastRatio(b, a))).toBeLessThan(
      EPS
    );
  });
});
