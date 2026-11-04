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

/** Chrome roles: quiet slate neutrals that carry no hue of their own. */
const NEUTRALS = [
  'background',
  'surface',
  'surfaceMuted',
  'surfaceElevated',
  'surfaceOverlay',
  'text',
  'textSecondary',
  'icon',
  'border',
  'outline',
  'disabled',
] as const satisfies readonly ColorTokenName[];

/** The one accent: links, the primary fill, selection and focus. */
const ACCENT = [
  'tint',
  'tintHover',
  'tintActive',
  'tintSubtle',
  'primaryStrong',
  'onPrimarySoft',
  'focusRing',
] as const satisfies readonly ColorTokenName[];

/** Neutrals may lean cool, never colorful: max channel spread out of 255. */
const NEUTRAL_SPREAD = 32;
/** Accent roles stay within this many degrees of one hue. */
const ACCENT_HUE_SPAN = 12;

function hue(color: string): number {
  const rgb = parseColor(color);
  if (rgb === null) throw new Error(`unparseable ${color}`);
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return Number.NaN;
  const h =
    max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe('application palette', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: chrome neutrals stay quiet`, () => {
      const loud = NEUTRALS.flatMap((name) => {
        const rgb = parseColor(COLOR_PALETTE[scheme][name]);
        if (rgb === null) return [`${name}: unparseable`];
        const spread =
          Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
        return spread <= NEUTRAL_SPREAD ? [] : [`${name}: spread ${spread}`];
      });
      expect(loud).toEqual([]);
    });

    test(`${scheme}: chrome has exactly one accent hue`, () => {
      const hues = ACCENT.map((name) => hue(COLOR_PALETTE[scheme][name]));
      expect(hues.every(Number.isFinite)).toBe(true);
      expect(Math.max(...hues) - Math.min(...hues)).toBeLessThanOrEqual(
        ACCENT_HUE_SPAN
      );
    });
  }
});
