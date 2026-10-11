/**
 * Spacing, typography, radius, and elevation scales, read from
 * `design-tokens.json`. Tailwind-like: 1 = 4px base unit.
 */

import type { ColorTokens } from './colors-types';
import { readGroup, readNumber, readPx } from './design-tokens';
import {
  font,
  opacity as opacityTokens,
  radius,
  space,
} from './design-tokens.json';

/** The 4px grid, keyed by step. The 2px half step is `'0-5'`. */
export const spacing = readGroup({ space }, space.scale, readPx);

/** Px of grid step `n`: the base unit is the scale's step 1. */
export const spacingScale = (n: number): number => n * spacing[1];

export type SpacingKey = keyof typeof spacing;

/**
 * The t-shirt scale every `gap` / `padding` prop takes (`SpaceToken`), as
 * `--ui-space-<name>`.
 */
export const spaceSize = readGroup({ space }, space.size, readPx);

/**
 * The classic typographic scale (12, 14, 16, 18, 21, 24, 36, 48), not a
 * linear ramp. Nothing in the product renders below 12px. Screens never pick
 * a size: they pick a role class (`textTitle`, `textCaption`, …) in
 * `hosts.css`, and the role picks the step.
 */
export const fontSize = readGroup({ font }, font.size, readPx);

/**
 * Unitless ratios. `tokens.css` emits them unitless. The sx codemod still
 * appends `px` (`leading-[1.25px]`) — that quirk stays so old snapshots match.
 */
export const lineHeight = readGroup({ font }, font.lineHeight, readNumber);

/**
 * Per-step leading in px, on the 4px grid. Body steps breathe (1.5); display
 * steps tighten as they grow. Paired with `fontSize` as `--ui-leading-*`.
 */
export const fontLeading = readGroup({ font }, font.leading, readPx);

/** Named weights, as `--ui-font-weight-*`. */
export const fontWeight = readGroup({ font }, font.weight, readNumber);

/**
 * Radius encodes hierarchy, so it is never one value everywhere:
 * `sm` marks and inline chips, `md` controls (buttons, inputs, rows),
 * `lg` panels that group controls, `xl` sheets and dialogs. `full` is only
 * for things that are round by nature: avatars, pills, the FAB, dots.
 */
export const borderRadius = readGroup({ radius }, radius.scale, readPx);

/**
 * The hierarchy by name (`RadiusToken`): `control`, `card` and `sheet` are
 * the `md`, `lg` and `xl` steps.
 */
export const radiusRole = readGroup({ radius }, radius.role, readPx);

/**
 * Named distances on top of the 4px grid. Page insets and stacks should
 * use these (`--ui-space-page`, …) so density is one edit.
 */
export const spaceRole = readGroup({ space }, space.role, readPx);

/** Named opacities as fractions (`muted` is 0.55), `--ui-opacity-*`. */
export const opacity = readGroup({}, opacityTokens, readNumber);

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
