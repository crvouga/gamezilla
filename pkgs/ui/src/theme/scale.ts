/**
 * Spacing, typography, radius, and elevation scales.
 * Tailwind-like: 1 = 4px base unit.
 */

import type { ColorTokens } from './colors';

export const spacingScale = (n: number): number => n * 4;

export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export type SpacingKey = keyof typeof spacing;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const;

/**
 * Industry-standard radius scale -- sharp, confident silhouettes. The legacy
 * `sm` / `md` / `lg` keys keep working but resolve to tighter values; the
 * inserted `xs` and `2xl` keys round out the scale.
 */
export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 28,
  full: 9999,
} as const;

export type BorderRadiusKey = keyof typeof borderRadius;

export type ElevationLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type ElevationStyle = {
  boxShadow?: string;
  /** Android elevation analogue. */
  elevation?: number;
  /**
   * Optional surface lift recommended for dark mode -- caller may layer
   * underneath. Light mode returns `undefined` so callers keep their
   * existing background.
   */
  backgroundColor?: string;
};

/**
 * Dark mode lifts via lighter surfaces (Material 3): higher elevation
 * levels pick up the matching surface tier so cards don't disappear into
 * the background. Nuclear overhaul: no `boxShadow` / Android elevation —
 * paint cost of multi-layer CSS shadows kills 60fps on low-end mobile web.
 */
function darkSurfaceFor(
  level: ElevationLevel,
  colors: Pick<ColorTokens, 'surface' | 'surfaceElevated' | 'surfaceOverlay'>
): string | undefined {
  if (level === 0) return undefined;
  if (level <= 2) return colors.surface;
  if (level <= 4) return colors.surfaceElevated;
  return colors.surfaceOverlay;
}

/**
 * Scheme-aware elevation. Light mode returns `{}` (no shadows). Dark mode
 * returns a recommended `backgroundColor` lift only — never `boxShadow`.
 */
export function makeElevation(
  colors: Pick<
    ColorTokens,
    'shadowColor' | 'surface' | 'surfaceElevated' | 'surfaceOverlay'
  >,
  scheme: 'light' | 'dark'
): (level: ElevationLevel) => ElevationStyle {
  return (level) => {
    if (level === 0) return {};
    if (scheme !== 'dark') return {};
    const bg = darkSurfaceFor(level, colors);
    return bg !== undefined ? { backgroundColor: bg } : {};
  };
}
