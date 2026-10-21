/**
 * Breakpoint-driven chrome metrics shared by `ActionBar` and the screen
 * header's back control.
 */

import type { BreakpointName } from '@pkgs/ui-root-shared/breakpoints';
import type { Accessor } from 'solid-js';
import { useThemeLayout } from './theme-context';

export type ActionBarChromeSpec = {
  buttonSize: number;
  gap: number;
  showInlineLabels: boolean;
  slotWidth: number;
};

const CHROME_BY_BREAKPOINT: Record<BreakpointName, ActionBarChromeSpec> = {
  mobile: {
    buttonSize: 40,
    gap: 8,
    showInlineLabels: false,
    slotWidth: 40,
  },
  tablet: {
    buttonSize: 40,
    gap: 8,
    showInlineLabels: true,
    slotWidth: 56,
  },
  desktop: {
    buttonSize: 44,
    gap: 8,
    showInlineLabels: true,
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
