/**
 * Spacing and typography scales.
 * Tailwind-like: 1 = 4px base unit.
 */

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

export const borderRadius = {
  none: 0,
  sm: 6,
  md: 12,
  lg: 18,
  xl: 22,
  full: 9999,
} as const;

export type BorderRadiusKey = keyof typeof borderRadius;

export type ElevationLevel = 0 | 1 | 2 | 3 | 4;

export const elevation = (level: ElevationLevel) => {
  if (level === 0) return {};

  const height = level * 2;
  const blur = level * 3;
  const opacity = 0.08 + level * 0.04;

  return {
    boxShadow: `0px ${height}px ${blur}px rgba(0, 0, 0, ${opacity})`,
    elevation: level * 2,
  };
};
