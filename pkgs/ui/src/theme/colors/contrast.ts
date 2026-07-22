/**
 * WCAG contrast helpers + automatic on-color resolution for CSS color strings.
 *
 * Parsing/formatting live in {@link ./css-color}; luminance math is delegated
 * to `@pkgs/colors`.
 */

import {
  contrastRatio as contrastRatioUnit,
  relativeLuminance as relativeLuminanceUnit,
} from '@pkgs/colors';

import {
  parseCssColor,
  rgb8ToRgba,
  rgbaToRgb8,
  type CssRgb8,
} from './css-color';

/** @deprecated Prefer {@link CssRgb8}; kept as `Rgb` for existing callers. */
export type Rgb = CssRgb8;

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
  fg: 'hsla(240, 10%, 4%, 1)',
  fgMuted: 'hsla(240, 10%, 4%, 0.64)',
  icon: 'hsla(240, 10%, 4%, 0.82)',
};

/** Parse a CSS color string to 0–255 RGB. Returns `null` for unsupported input. */
export function parseColor(input: string): Rgb | null {
  const c = parseCssColor(input);
  if (!c) return null;
  return rgbaToRgb8(c);
}

/** WCAG relative luminance (0 = black, 1 = white). Input channels are 0–255. */
export function relativeLuminance(rgb: Rgb): number {
  return relativeLuminanceUnit(rgb8ToRgba(rgb));
}

/** WCAG contrast ratio between two 0–255 RGB colors (1:1 to 21:1). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  return contrastRatioUnit(rgb8ToRgba(a), rgb8ToRgba(b));
}

/** Options for {@link bestOnColor}. */
export type BestOnColorOptions = {
  light?: OnColorSet;
  dark?: OnColorSet;
};

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
  const bg = parseColor(background);
  if (!bg) return onDark;
  const whiteRgb = parseColor(onDark.fg);
  const blackRgb = parseColor(onLight.fg);
  if (!whiteRgb || !blackRgb) return onDark;
  const whiteContrast = contrastRatio(whiteRgb, bg);
  const blackContrast = contrastRatio(blackRgb, bg);
  return whiteContrast >= blackContrast ? onDark : onLight;
}
