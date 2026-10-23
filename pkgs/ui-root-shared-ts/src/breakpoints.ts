/**
 * Layout breakpoints (width in dp / CSS px), read from `design-tokens.json`.
 * Single source of truth for responsive shells and for every `Responsive`
 * prop of the design system.
 *
 * - **mobile**: &lt; {@link BREAKPOINT_MIN_TABLET}
 * - **tablet**: {@link BREAKPOINT_MIN_TABLET} &le; width &lt; {@link BREAKPOINT_MIN_DESKTOP}
 * - **desktop**: &ge; {@link BREAKPOINT_MIN_DESKTOP}
 */

import { readGroup, readPx } from './design-tokens';
import { breakpoint as breakpointTokens } from './design-tokens.json';

/** Minimum viewport width in px per `BreakpointToken`. */
export const breakpoint = readGroup({}, breakpointTokens, readPx);

/** Minimum width for tablet layout (sidebar, etc.): the `md` breakpoint. */
export const BREAKPOINT_MIN_TABLET = breakpoint.md;

/** Minimum width for desktop-optimized layout (wider chrome): `lg`. */
export const BREAKPOINT_MIN_DESKTOP = breakpoint.lg;

export type BreakpointName = 'mobile' | 'tablet' | 'desktop';

export function getBreakpoint(width: number): BreakpointName {
  if (width >= BREAKPOINT_MIN_DESKTOP) {
    return 'desktop';
  }
  if (width >= BREAKPOINT_MIN_TABLET) {
    return 'tablet';
  }
  return 'mobile';
}
