/**
 * Resolve a color token name / CSS color against the theme palette.
 */

import type { ColorTokenName, ColorTokens } from './colors';

const COLOR_ALIASES = {
  danger: 'destructive',
  error: 'destructive',
  primary: 'tint',
} as const satisfies Record<string, ColorTokenName>;

const CSS_COLOR_KEYWORDS = new Set([
  'transparent',
  'inherit',
  'currentcolor',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);

const TOKEN_LIKE = /^[a-zA-Z][\w-]*$/;

/**
 * Resolve a color to a concrete CSS color string.
 *
 * - Palette tokens (and intent aliases like `danger`) → theme value
 * - Raw CSS (`#fff`, `hsla(...)`, keywords) → passed through
 * - Unknown token-like names → `undefined`
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
  if (!TOKEN_LIKE.test(aliased)) return aliased;
  return undefined;
}
