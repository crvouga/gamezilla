/**
 * Layout breakpoints (width in dp / CSS px). Single source of truth for responsive shells.
 *
 * - **mobile**: &lt; {@link BREAKPOINT_MIN_TABLET}
 * - **tablet**: {@link BREAKPOINT_MIN_TABLET} &le; width &lt; {@link BREAKPOINT_MIN_DESKTOP}
 * - **desktop**: &ge; {@link BREAKPOINT_MIN_DESKTOP}
 */

/** Minimum width for tablet layout (sidebar, etc.). */
export const BREAKPOINT_MIN_TABLET = 768;

/** Minimum width for desktop-optimized layout (wider chrome). */
export const BREAKPOINT_MIN_DESKTOP = 1024;

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
