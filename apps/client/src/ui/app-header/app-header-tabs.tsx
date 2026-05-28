/**
 * Hosts the navigator's `BottomTabBar` inside the desktop screen header's
 * center slot. Visually and behaviorally identical to the mobile bottom
 * bar -- it IS the same component, fed the same live `BottomTabBarProps`
 * via {@link useTabBarProps} (published by {@link AppTabBarBridge}).
 *
 * The wrapper is a column flex (the navigator's natural parent shape):
 * `BottomTabBar`'s outer view has no `flex` or `width` of its own, so
 * inside a row-flex parent it collapses to its content width (and its
 * `flex: 1` items then shrink to `flex-basis: 0`, ellipsizing labels).
 * A column parent makes the bar take 100% width by default, so each tab
 * gets the full {@link HEADER_TAB_WIDTH} slot. `style.height` is the only
 * `style` prop `BottomTabBar` honors (via `getTabBarHeight`); it pins the
 * row to {@link TOP_BAR_CONTENT_HEIGHT} so the header chrome stays a
 * uniform height across every screen.
 */

import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { Box, TOP_BAR_CONTENT_HEIGHT } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { useTabBarProps } from './app-tab-bar-context';

const HEADER_TAB_WIDTH = 160;

export function AppHeaderTabs(): ReactNode {
  const props = useTabBarProps();
  if (props === null) return null;
  const width = props.state.routes.length * HEADER_TAB_WIDTH;
  return (
    <Box sx={{ width, height: TOP_BAR_CONTENT_HEIGHT }}>
      <BottomTabBar {...props} style={{ height: TOP_BAR_CONTENT_HEIGHT }} />
    </Box>
  );
}
