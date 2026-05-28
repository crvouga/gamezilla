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

type ElevationLayer = {
  y: number;
  blur: number;
  alphaMul: number;
};

const ELEVATION_LAYERS: Record<ElevationLevel, ElevationLayer[]> = {
  0: [],
  // Soft, linear-style shadows. Single layer at the lower tiers (no
  // contact shadow doubling), broader/softer blur at the higher tiers.
  // Alphas are tuned so light-mode reads as "lifted off the page" without
  // any one card hogging the visual weight.
  1: [{ y: 1, blur: 2, alphaMul: 0.35 }],
  2: [{ y: 2, blur: 6, alphaMul: 0.45 }],
  3: [
    { y: 1, blur: 2, alphaMul: 0.3 },
    { y: 4, blur: 12, alphaMul: 0.5 },
  ],
  4: [
    { y: 2, blur: 4, alphaMul: 0.35 },
    { y: 8, blur: 24, alphaMul: 0.6 },
  ],
  5: [
    { y: 4, blur: 8, alphaMul: 0.4 },
    { y: 16, blur: 40, alphaMul: 0.7 },
  ],
};

const ANDROID_ELEVATION: Record<ElevationLevel, number> = {
  0: 0,
  1: 1,
  2: 3,
  3: 6,
  4: 12,
  5: 18,
};

/**
 * Dark mode lifts via lighter surfaces (Material 3): higher elevation
 * levels pick up the matching surface tier so cards don't disappear into
 * the background even when the shadow is faint.
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
 * Scheme-aware elevation. `theme.elevation(level)` returns a style fragment
 * that callers spread into a wrapper view. Light mode returns shadows only
 * (callers keep their own background); dark mode returns shadows + a
 * recommended `backgroundColor` lift derived from the active surface tiers.
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
    const layers = ELEVATION_LAYERS[level]
      .map(
        (l) =>
          `0px ${l.y}px ${l.blur}px ${shadowColorWithAlpha(
            colors.shadowColor,
            l.alphaMul
          )}`
      )
      .join(', ');
    const style: ElevationStyle = {
      boxShadow: layers,
      elevation: ANDROID_ELEVATION[level],
    };
    if (scheme === 'dark') {
      const bg = darkSurfaceFor(level, colors);
      if (bg) style.backgroundColor = bg;
    }
    return style;
  };
}

/**
 * Multiplies the alpha component of an rgba/hsla/hex shadow color. Falls
 * back to returning the raw color when we can't parse it -- callers always
 * get a valid CSS color back.
 */
function shadowColorWithAlpha(base: string, mul: number): string {
  const hsla = base.match(
    /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)/
  );
  if (hsla) {
    const h = hsla[1];
    const s = hsla[2];
    const l = hsla[3];
    const a = hsla[4] === undefined ? 1 : Number(hsla[4]);
    return `hsla(${h}, ${s}%, ${l}%, ${(a * mul).toFixed(3)})`;
  }
  const rgba = base.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/
  );
  if (rgba) {
    const r = rgba[1];
    const g = rgba[2];
    const b = rgba[3];
    const a = rgba[4] === undefined ? 1 : Number(rgba[4]);
    return `rgba(${r}, ${g}, ${b}, ${(a * mul).toFixed(3)})`;
  }
  if (base.startsWith('#')) {
    return `${base}${Math.round(mul * 255)
      .toString(16)
      .padStart(2, '0')}`;
  }
  return base;
}

/**
 * Legacy no-scheme elevation helper. Kept so consumers that didn't migrate
 * to `theme.elevation()` keep rendering a (light-mode) shadow. New code
 * should prefer `theme.elevation()`.
 */
export const elevation = (level: ElevationLevel): ElevationStyle => {
  if (level === 0) return {};
  const layers = ELEVATION_LAYERS[level]
    .map(
      (l) =>
        `0px ${l.y}px ${l.blur}px rgba(0, 0, 0, ${(0.12 * l.alphaMul).toFixed(3)})`
    )
    .join(', ');
  return {
    boxShadow: layers,
    elevation: ANDROID_ELEVATION[level],
  };
};
