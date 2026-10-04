/**
 * Token resolution for the `sx` → CSS compiler.
 */

import type {
  ColorTokenName,
  ColorTokens,
} from '@pkgs/ui-root-shared/colors-types';
import {
  borderRadius,
  fontSize,
  lineHeight,
  spacing,
  spacingScale,
} from '@pkgs/ui-root-shared/scale';
import type { SxRadius } from './legacy-sx-props';

export function resolveSpacing(n: number): number {
  const known = (spacing as Record<number, number | undefined>)[n];
  return known ?? spacingScale(n);
}

/**
 * Intent-style aliases → palette tokens. Button `intent="danger"` maps here so
 * `sx={{ color: 'danger' }}` stays theme-aware instead of emitting invalid CSS.
 */
const COLOR_ALIASES = {
  danger: 'destructive',
  error: 'destructive',
  primary: 'tint',
} as const satisfies Record<string, ColorTokenName>;

/** CSS color keywords that are valid without being palette tokens. */
const CSS_COLOR_KEYWORDS = new Set([
  'transparent',
  'inherit',
  'currentcolor',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);

/** Bare identifier that looks like a mistaken token name (not a CSS color). */
const TOKEN_LIKE = /^[a-zA-Z][\w-]*$/;

/**
 * Resolve an sx color to a concrete CSS color string.
 *
 * - Palette tokens (and intent aliases like `danger`) → theme value
 * - Raw CSS (`#fff`, `hsla(...)`, keywords) → passed through
 * - Unknown token-like names → `undefined` (do not emit invalid CSS that
 *   falls back to the browser's near-black default on dark backgrounds)
 */
export function resolveColor(
  value: string | undefined,
  colors: ColorTokens
): string | undefined {
  if (!value) return undefined;
  const aliased =
    value in COLOR_ALIASES
      ? COLOR_ALIASES[value as keyof typeof COLOR_ALIASES]
      : value;
  if (aliased in colors) return colors[aliased as ColorTokenName];
  if (CSS_COLOR_KEYWORDS.has(aliased.toLowerCase())) return aliased;
  // Hex / rgb / hsl / lengths — not a bare token name.
  if (!TOKEN_LIKE.test(aliased)) return aliased;
  return undefined;
}

export function resolveFontSize(
  value: number | keyof typeof fontSize | undefined
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  return fontSize[value];
}

export function resolveLineHeight(
  value: number | keyof typeof lineHeight | undefined
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  return lineHeight[value];
}

export function resolveRadius(value: SxRadius | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  return borderRadius[value];
}
