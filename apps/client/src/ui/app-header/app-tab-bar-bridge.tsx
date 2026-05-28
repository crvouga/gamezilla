/**
 * The single tab-bar slot supplied to expo-router's `Tabs` navigator.
 *
 * Two responsibilities:
 * 1. Publish the live {@link BottomTabBarProps} so the desktop screen
 *    header can re-host the same `BottomTabBar` inside its center slot.
 * 2. Render the actual `BottomTabBar` at the bottom on mobile breakpoints
 *    only. Returning `null` on tablet/desktop keeps the bar from being
 *    drawn twice while still letting the navigator manage its lifecycle.
 */

import {
  BottomTabBar,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { useBreakpoint } from '@pkgs/ui';
import { useLayoutEffect, type ReactNode } from 'react';

import { publishTabBarProps } from './app-tab-bar-context';

export function AppTabBarBridge(props: BottomTabBarProps): ReactNode {
  const isMobile = useBreakpoint() === 'mobile';

  useLayoutEffect(() => {
    publishTabBarProps(props);
  }, [props]);

  if (!isMobile) return null;
  return <BottomTabBar {...props} />;
}
