import { describe, expect, test } from 'bun:test';
import { PALETTE } from './color-palette';
import {
  bestOnColor,
  contrastRatio,
  ON_DARK,
  ON_LIGHT,
  parseColor,
  relativeLuminance,
} from './contrast';
import type { ColorScheme, ColorTokens } from './types';

const AA_NORMAL = 4.5;
const SCHEMES: ReadonlyArray<ColorScheme> = ['light', 'dark'];

function ratio(a: string, b: string): number {
  const ra = parseColor(a);
  const rb = parseColor(b);
  if (!ra || !rb) throw new Error(`unparseable color pair: ${a} / ${b}`);
  return contrastRatio(ra, rb);
}

describe('color parsing', () => {
  test('parses 6-digit hex', () => {
    expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  test('parses short hex', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  test('parses rgb / rgba (ignoring alpha)', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseColor('rgba(0, 128, 255, 0.5)')).toEqual({
      r: 0,
      g: 128,
      b: 255,
    });
  });

  test('parses hsl / hsla', () => {
    expect(parseColor('hsla(0, 0%, 100%, 1)')).toEqual({
      r: 255,
      g: 255,
      b: 255,
    });
    expect(parseColor('hsl(0, 0%, 0%)')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseColor('hsla(0, 100%, 50%, 1)')).toEqual({ r: 255, g: 0, b: 0 });
  });

  test('returns null for unsupported input', () => {
    expect(parseColor('not-a-color')).toBeNull();
  });
});

describe('luminance + contrast', () => {
  test('luminance endpoints', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });

  test('white vs black is the maximum 21:1', () => {
    expect(ratio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  test('contrast is symmetric', () => {
    expect(ratio('#ffffff', '#1d4ed8')).toBeCloseTo(
      ratio('#1d4ed8', '#ffffff'),
      5
    );
  });
});

describe('bestOnColor', () => {
  test('white family on a dark fill', () => {
    expect(bestOnColor('#000000')).toEqual(ON_DARK);
    expect(bestOnColor('hsla(221, 83%, 40%, 1)')).toEqual(ON_DARK);
  });

  test('near-black family on a light fill', () => {
    expect(bestOnColor('#ffffff')).toEqual(ON_LIGHT);
    expect(bestOnColor('hsla(43, 96%, 56%, 1)')).toEqual(ON_LIGHT);
  });

  test('chosen foreground always clears AA against the fill', () => {
    for (const fill of [
      '#000000',
      '#ffffff',
      '#1d4ed8',
      '#f5a623',
      '#22a06b',
    ]) {
      expect(ratio(bestOnColor(fill).fg, fill)).toBeGreaterThanOrEqual(
        AA_NORMAL
      );
    }
  });
});

// Solid fills paired with the label token actually rendered on top of them.
// Each pair must clear AA in BOTH schemes or a button/badge label is illegible.
const SOLID_FILL_PAIRS: ReadonlyArray<
  readonly [fill: keyof ColorTokens, label: keyof ColorTokens]
> = [
  ['tintActive', 'onPrimary'],
  ['destructiveActive', 'onDestructive'],
  ['success', 'onSuccess'],
  ['warning', 'onWarning'],
  ['info', 'onInfo'],
];

// Accent/foreground tokens rendered as text on the page background.
const FOREGROUND_ON_BACKGROUND: ReadonlyArray<keyof ColorTokens> = [
  'text',
  'tint',
  'destructive',
];

describe('palette contrast contract', () => {
  for (const scheme of SCHEMES) {
    const tokens = PALETTE[scheme];

    for (const [fill, label] of SOLID_FILL_PAIRS) {
      test(`${scheme}: ${label} on ${fill} >= AA`, () => {
        expect(ratio(tokens[label], tokens[fill])).toBeGreaterThanOrEqual(
          AA_NORMAL
        );
      });
    }

    for (const fg of FOREGROUND_ON_BACKGROUND) {
      test(`${scheme}: ${fg} on background >= AA`, () => {
        expect(ratio(tokens[fg], tokens.background)).toBeGreaterThanOrEqual(
          AA_NORMAL
        );
      });
    }
  }
});
