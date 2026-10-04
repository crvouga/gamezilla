/**
 * Breakpoint-driven chrome metrics shared by `TopBar`, `ActionBar`,
 * `AppHeaderIsland` and friends.
 */

import type { BreakpointName } from '@pkgs/ui-shared/breakpoints';
import type { Accessor } from 'solid-js';
import { useThemeLayout } from './theme-context';

/** Mobile default — kept as the exported `TOP_BAR_CONTENT_HEIGHT` constant. */
export const TOP_BAR_CONTENT_HEIGHT_MOBILE = 56;

export type ActionBarChromeSpec = {
  buttonSize: number;
  gap: number;
  showInlineLabels: boolean;
  slotWidth: number;
  topBarContentHeight: number;
};

const CHROME_BY_BREAKPOINT: Record<BreakpointName, ActionBarChromeSpec> = {
  mobile: {
    buttonSize: 32,
    gap: 6,
    showInlineLabels: false,
    slotWidth: 32,
    topBarContentHeight: TOP_BAR_CONTENT_HEIGHT_MOBILE,
  },
  tablet: {
    buttonSize: 40,
    gap: 8,
    showInlineLabels: true,
    slotWidth: 56,
    topBarContentHeight: 64,
  },
  desktop: {
    buttonSize: 44,
    gap: 8,
    showInlineLabels: true,
    slotWidth: 60,
    topBarContentHeight: 72,
  },
};

export function getActionBarChrome(
  breakpoint: BreakpointName
): ActionBarChromeSpec {
  return CHROME_BY_BREAKPOINT[breakpoint];
}

export function getTopBarContentHeight(breakpoint: BreakpointName): number {
  return getActionBarChrome(breakpoint).topBarContentHeight;
}

export function useActionBarChrome(): Accessor<ActionBarChromeSpec> {
  const layout = useThemeLayout();
  return () => getActionBarChrome(layout.breakpoint());
}
