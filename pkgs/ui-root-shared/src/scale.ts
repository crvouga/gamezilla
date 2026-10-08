/**
 * Spacing, typography, radius, and elevation scales.
 * Tailwind-like: 1 = 4px base unit.
 */

import type { ColorTokens } from './colors-types';

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

/**
 * The classic typographic scale (12, 14, 16, 18, 21, 24, 36, 48), not a
 * linear ramp. Nothing in the product renders below 12px. Screens never pick
 * a size: they pick a role class (`textTitle`, `textCaption`, …) in
 * `hosts.css`, and the role picks the step.
 */
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 21,
  '2xl': 24,
  '3xl': 36,
  '4xl': 48,
} as const;

/**
 * Unitless ratios. `tokens.css` emits them unitless. The sx codemod still
 * appends `px` (`leading-[1.25px]`) — that quirk stays so old snapshots match.
 */
export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const;

/**
 * Per-step leading in px, on the 4px grid. Body steps breathe (1.5); display
 * steps tighten as they grow. Paired with `fontSize` as `--ui-leading-*`.
 */
export const fontLeading = {
  xs: 16,
  sm: 20,
  base: 24,
  lg: 24,
  xl: 28,
  '2xl': 28,
  '3xl': 40,
  '4xl': 52,
} as const;

/**
 * Radius encodes hierarchy, so it is never one value everywhere:
 * `sm` marks and inline chips, `md` controls (buttons, inputs, rows),
 * `lg` panels that group controls, `xl` sheets and dialogs. `full` is only
 * for things that are round by nature: avatars, pills, the FAB, dots.
 */
export const borderRadius = {
  none: 0,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  '2xl': 36,
  full: 9999,
} as const;

/**
 * Named distances on top of the 4px grid. Page insets and stacks should
 * use these (`--ui-space-page`, …) so density is one edit.
 */
export const spaceRole = {
  hairline: 1,
  inline: spacing[2],
  stack: spacing[3],
  section: spacing[6],
  page: spacing[5],
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
