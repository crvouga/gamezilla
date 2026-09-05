/**
 * Layout mode for the island shell: `compact` (mobile + tablet) vs `wide`
 * (desktop). Single mapping from {@link BreakpointName} → mode so product
 * code never branches on breakpoints for chrome.
 */

import type { BreakpointName } from './breakpoints';
import { useThemeLayout } from './theme-context';

export type LayoutMode = 'compact' | 'wide';

/** Map a breakpoint bucket to a layout mode. Desktop → wide; else compact. */
export function getLayoutMode(breakpoint: BreakpointName): LayoutMode {
  if (breakpoint === 'desktop') {
    return 'wide';
  }
  return 'compact';
}

/** Current layout mode from the theme host's measured width. */
export function useLayoutMode(): LayoutMode {
  const { breakpoint } = useThemeLayout();
  return getLayoutMode(breakpoint);
}
