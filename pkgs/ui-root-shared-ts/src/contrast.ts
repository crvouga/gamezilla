/**
 * WCAG contrast helpers + automatic on-color resolution for CSS color strings.
 *
 * Parsing/formatting live in {@link ./css-color}; luminance math is delegated
 * to `@pkgs/colors-shared-ts`.
 */

import {
  contrastRatio as contrastRatioUnit,
  relativeLuminance as relativeLuminanceUnit,
} from '@pkgs/colors-shared-ts/luminance';
import type { Rgba } from '@pkgs/colors-shared-ts/types';
import { clamp01, rgba } from '@pkgs/colors-shared-ts/types';

import type { CssRgb8 } from './css-color';
import { parseCssColor, rgb8ToRgba, rgbaToRgb8 } from './css-color';

/** Foreground colors to render on top of a given background. */
export type OnColorSet = {
  /** Primary label color (full strength). */
  fg: string;
  /** Secondary / caption color (same family, reduced emphasis). */
  fgMuted: string;
  /** Icon color (slightly softer than `fg`, still high contrast). */
  icon: string;
};

/** Foreground set for use on dark backgrounds (white family). */
export const ON_DARK: OnColorSet = {
  fg: 'hsla(0, 0%, 100%, 1)',
  fgMuted: 'hsla(0, 0%, 100%, 0.76)',
  icon: 'hsla(0, 0%, 100%, 0.92)',
};

/** Foreground set for use on light backgrounds (near-black family). */
export const ON_LIGHT: OnColorSet = {
  fg: 'hsla(0, 0%, 4%, 1)',
  fgMuted: 'hsla(0, 0%, 4%, 0.64)',
  icon: 'hsla(0, 0%, 4%, 0.82)',
};

/** Parse a CSS color string to 0–255 RGB. Returns `null` for unsupported input. */
export function parseColor(input: string): CssRgb8 | null {
  const c = parseCssColor(input);
  if (!c) return null;
  return rgbaToRgb8(c);
}

/** WCAG relative luminance (0 = black, 1 = white). Input channels are 0–255. */
export function relativeLuminance(rgb: CssRgb8): number {
  return relativeLuminanceUnit(rgb8ToRgba(rgb));
}

/** WCAG contrast ratio between two 0–255 RGB colors (1:1 to 21:1). */
export function contrastRatio(a: CssRgb8, b: CssRgb8): number {
  return contrastRatioUnit(rgb8ToRgba(a), rgb8ToRgba(b));
}

/** Options for {@link bestOnColor}. */
export type BestOnColorOptions = {
  light?: OnColorSet;
  dark?: OnColorSet;
  /** When `background` is translucent, composite over this color first. */
  backdrop?: string;
};

/** Porter-Duff source-over: `fg` painted on top of `backdrop`. */
export function compositeOver(fg: Rgba, backdrop: Rgba): Rgba {
  const fgA = clamp01(fg.a);
  const bgA = clamp01(backdrop.a);
  const outA = fgA + bgA * (1 - fgA);
  if (outA === 0) return rgba(0, 0, 0, 0);
  const inv = 1 - fgA;
  return rgba(
    (fg.r * fgA + backdrop.r * bgA * inv) / outA,
    (fg.g * fgA + backdrop.g * bgA * inv) / outA,
    (fg.b * fgA + backdrop.b * bgA * inv) / outA,
    outA
  );
}

function effectiveBackgroundRgb(
  background: string,
  backdrop?: string
): CssRgb8 | null {
  const fg = parseCssColor(background);
  if (!fg) return null;
  if (backdrop !== undefined && fg.a < 1) {
    const bg = parseCssColor(backdrop);
    if (bg) return rgbaToRgb8(compositeOver(fg, bg));
  }
  return rgbaToRgb8(fg);
}

/**
 * Pick the foreground set (`ON_DARK` white family vs `ON_LIGHT` near-black
 * family) that has the higher contrast ratio against `background`. Falls back
 * to `ON_DARK` for unparseable input (most saturated brand fills are dark
 * enough that white wins).
 */
export function bestOnColor(
  background: string,
  options?: BestOnColorOptions
): OnColorSet {
  const onDark = options?.dark ?? ON_DARK;
  const onLight = options?.light ?? ON_LIGHT;
  const bg = effectiveBackgroundRgb(background, options?.backdrop);
  if (!bg) return onDark;
  const whiteRgb = parseColor(onDark.fg);
  const blackRgb = parseColor(onLight.fg);
  if (!whiteRgb || !blackRgb) return onDark;
  const whiteContrast = contrastRatio(whiteRgb, bg);
  const blackContrast = contrastRatio(blackRgb, bg);
  return whiteContrast >= blackContrast ? onDark : onLight;
}
