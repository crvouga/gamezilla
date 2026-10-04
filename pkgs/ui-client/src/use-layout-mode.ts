/**
 * Layout mode for the island shell: `compact` (mobile + tablet) vs `wide`
 * (desktop). Single mapping from {@link BreakpointName} → mode so product
 * code never branches on breakpoints for chrome.
 */

import type { Accessor } from 'solid-js';
import type { BreakpointName } from '@pkgs/ui-shared/breakpoints';
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
export function useLayoutMode(): Accessor<LayoutMode> {
  const layout = useThemeLayout();
  return () => getLayoutMode(layout.breakpoint());
}
