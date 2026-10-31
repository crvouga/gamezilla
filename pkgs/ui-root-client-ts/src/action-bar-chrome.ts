/**
 * Breakpoint-driven chrome metrics shared by `ActionBar` and the screen
 * header's back control. Header actions are icon-only at every breakpoint
 * (a 40px disc, a 24px glyph, the name in the tooltip and accessible name),
 * so a 52px header row is one row everywhere; `slotWidth` is the width of a
 * labeled control where a taller bar opts into `showInlineLabels`.
 */

import type { BreakpointName } from '@pkgs/ui-root-shared-ts/breakpoints';
import type { Accessor } from 'solid-js';
import { useThemeLayout } from './theme-context/index';

export type ActionBarChromeSpec = {
  buttonSize: number;
  gap: number;
  slotWidth: number;
};

const CHROME_BY_BREAKPOINT: Record<BreakpointName, ActionBarChromeSpec> = {
  mobile: {
    buttonSize: 40,
    gap: 8,
    slotWidth: 44,
  },
  tablet: {
    buttonSize: 40,
    gap: 8,
    slotWidth: 56,
  },
  desktop: {
    buttonSize: 40,
    gap: 8,
    slotWidth: 60,
  },
};

export function getActionBarChrome(
  breakpoint: BreakpointName
): ActionBarChromeSpec {
  return CHROME_BY_BREAKPOINT[breakpoint];
}

export function useActionBarChrome(): Accessor<ActionBarChromeSpec> {
  const layout = useThemeLayout();
  return () => getActionBarChrome(layout.breakpoint());
}
