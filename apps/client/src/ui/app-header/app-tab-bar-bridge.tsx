/**
 * Tab bar slot for expo-router's `Tabs` navigator.
 *
 * Publishes live {@link BottomTabBarProps} for the desktop header and renders
 * the same standalone {@link AppTabBar} at the bottom on mobile only.
 */

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useBreakpoint } from '@pkgs/ui';
import { useLayoutEffect, type ReactNode } from 'react';

import { AppTabBar } from './app-tab-bar';
import { publishTabBarProps } from './app-tab-bar-context';

const BOTTOM_LAYOUT = 'bottom' as const;

export function AppTabBarBridge(props: BottomTabBarProps): ReactNode {
  const isMobile = useBreakpoint() === 'mobile';

  useLayoutEffect(() => {
    publishTabBarProps(props);
  }, [props]);

  if (!isMobile) return null;
  return <AppTabBar {...props} layout={BOTTOM_LAYOUT} />;
}
