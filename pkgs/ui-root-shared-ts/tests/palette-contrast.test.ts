import { describe, expect, test } from 'bun:test';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';
import type {
  ColorScheme,
  ColorTokenName,
} from '@pkgs/ui-root-shared-ts/colors-types';
import {
  compositeOver,
  contrastRatio,
  parseColor,
  relativeLuminance,
} from '@pkgs/ui-root-shared-ts/contrast';
import { parseCssColor, rgbaToRgb8 } from '@pkgs/ui-root-shared-ts/css-color';

/**
 * WCAG AA: body text 4.5:1; large text, borders that carry meaning, focus
 * rings and icons 3:1.
 */
const TEXT = 4.5;
const GLYPH = 3;

type Pair = readonly [fg: ColorTokenName, bg: ColorTokenName, minimum: number];

const PLAYERS = [
  'player1',
  'player2',
  'player3',
  'player4',
  'player5',
  'player6',
  'player7',
  'player8',
] as const satisfies readonly ColorTokenName[];

/**
 * Seat colors must differ in lightness, not only hue, so a person who cannot
 * tell the hues apart can still tell the seats apart: every two seat colors
 * sit at least this far apart in CIELAB lightness (L*, 0–100).
 */
const PLAYER_LIGHTNESS_STEP = 4.5;

/**
 * Every foreground the design system paints, on every surface it paints it
 * on. Translucent surfaces composite over `background` first.
 */
const PAIRS: readonly Pair[] = [
  ...(
    [
      'pathRed',
      'pathOrange',
      'pathYellow',
      'pathGreen',
      'pathBlue',
      'pathPurple',
    ] as const
  ).map((fg): Pair => [fg, 'background', GLYPH]),
  ...PLAYERS.flatMap((fg): Pair[] => [
    [fg, 'background', GLYPH],
    [fg, 'surface', GLYPH],
    [fg, 'boardCell', GLYPH],
  ]),
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
    ['outline', bg, GLYPH],
    ['focusRing', bg, GLYPH],
    ['primaryStrong', bg, GLYPH],
  ]),
  ['onLive', 'live', TEXT],
  ['onPrimarySoft', 'tintSubtle', TEXT],
  ['text', 'tintSubtle', TEXT],
  ['boardCardInk', 'boardCardFace', TEXT],
  ['boardCardInkRed', 'boardCardFace', TEXT],
  ['onPrimary', 'tintActive', TEXT],
  ['onDestructive', 'destructiveActive', TEXT],
  ['onSuccess', 'success', TEXT],
  ['onWarning', 'warning', TEXT],
  ['onInfo', 'info', TEXT],
  ['tint', 'tintSubtle', TEXT],
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

/** CIELAB L* of an opaque color: perceived lightness, 0 (black) to 100. */
function lightness(color: string): number {
  const rgb = parseColor(color);
  if (rgb === null) throw new Error(`unparseable ${color}`);
  const y = relativeLuminance(rgb);
  const f = y > 216 / 24389 ? Math.cbrt(y) : ((24389 / 27) * y + 16) / 116;
  return 116 * f - 16;
}

describe('player colors', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: every two seats differ in lightness`, () => {
      const colors = COLOR_PALETTE[scheme];
      const close = PLAYERS.flatMap((a, i) =>
        PLAYERS.slice(i + 1).flatMap((b) => {
          const step = Math.abs(lightness(colors[a]) - lightness(colors[b]));
          return step >= PLAYER_LIGHTNESS_STEP
            ? []
            : [`${a} and ${b}: L* ${step.toFixed(1)} apart`];
        })
      );
      expect(close).toEqual([]);
    });
  }
});

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

describe('application palette', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: application colors are achromatic`, () => {
      for (const [name, value] of Object.entries(COLOR_PALETTE[scheme])) {
        if (name.startsWith('game') || name.startsWith('path')) continue;
        const rgb = parseColor(value);
        expect(rgb, name).not.toBeNull();
        expect(rgb?.r, name).toBe(rgb?.g);
        expect(rgb?.g, name).toBe(rgb?.b);
      }
    });
  }
});
