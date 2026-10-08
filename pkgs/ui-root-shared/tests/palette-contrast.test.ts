import { describe, expect, test } from 'bun:test';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared/color-palette';
import type {
  ColorScheme,
  ColorTokenName,
} from '@pkgs/ui-root-shared/colors-types';
import {
  compositeOver,
  contrastRatio,
  parseColor,
} from '@pkgs/ui-root-shared/contrast';
import { parseCssColor, rgbaToRgb8 } from '@pkgs/ui-root-shared/css-color';

/** WCAG AA: body text 4.5:1, large text and UI glyphs 3:1. */
const TEXT = 4.5;
const GLYPH = 3;

type Pair = readonly [fg: ColorTokenName, bg: ColorTokenName, minimum: number];

/**
 * Every foreground the design system paints, on every surface it paints it
 * on. Translucent surfaces composite over `background` first.
 */
const PAIRS: readonly Pair[] = [
  ...(
    [
      'background',
      'surface',
      'surfaceMuted',
      'surfaceElevated',
      'surfaceOverlay',
    ] as const
  ).flatMap((bg): Pair[] => [
    ['text', bg, TEXT],
    ['textSecondary', bg, TEXT],
    ['tint', bg, TEXT],
    ['destructive', bg, TEXT],
    ['success', bg, TEXT],
    ['warning', bg, TEXT],
    ['info', bg, TEXT],
    ['icon', bg, GLYPH],
    ['tabIconDefault', bg, GLYPH],
    ['tabIconSelected', bg, GLYPH],
  ]),
  ['onPrimary', 'tintActive', TEXT],
  ['onDestructive', 'destructiveActive', TEXT],
  ['onSuccess', 'success', TEXT],
  ['onWarning', 'warning', TEXT],
  ['onInfo', 'info', TEXT],
  ['tint', 'tintSubtle', TEXT],
  ['tint', 'tintHighlight', TEXT],
  ['destructive', 'destructiveSurface', TEXT],
  ['success', 'successSurface', TEXT],
  ['warning', 'warningSurface', TEXT],
  ['info', 'infoSurface', TEXT],
  ['textSecondary', 'disabled', GLYPH],
];

function ratio(scheme: ColorScheme, fg: ColorTokenName, bg: ColorTokenName) {
  const colors = COLOR_PALETTE[scheme];
  const canvas = parseCssColor(colors.background);
  const back = parseCssColor(colors[bg]);
  const front = parseColor(colors[fg]);
  if (canvas === null || back === null || front === null) {
    throw new Error(`unparseable ${scheme} ${fg} on ${bg}`);
  }
  return contrastRatio(front, rgbaToRgb8(compositeOver(back, canvas)));
}

describe('palette contrast', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: every text and glyph pair meets WCAG AA`, () => {
      const failures = PAIRS.flatMap(([fg, bg, minimum]) => {
        const value = ratio(scheme, fg, bg);
        return value >= minimum
          ? []
          : [`${fg} on ${bg}: ${value.toFixed(2)} < ${minimum}`];
      });
      expect(failures).toEqual([]);
    });
  }
});
