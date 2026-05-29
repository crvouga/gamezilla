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
import { TOP_BAR_CONTENT_HEIGHT, useBreakpoint } from '@pkgs/ui';
import { useLayoutEffect, type ReactNode } from 'react';

import { publishTabBarProps } from './app-tab-bar-context';

export function AppTabBarBridge(props: BottomTabBarProps): ReactNode {
  const isMobile = useBreakpoint() === 'mobile';

  useLayoutEffect(() => {
    publishTabBarProps(props);
  }, [props]);

  if (!isMobile) return null;
  // React Navigation's default UIKit bar is 49pt tall, but the stacked
  // icon (28pt wrapper) + `fontSize: 13` label + 5pt vertical padding need
  // 56pt, so the default clips the label. Pin the content row to the same
  // `TOP_BAR_CONTENT_HEIGHT` the desktop header re-host uses (see
  // `AppHeaderTabs`), adding the bottom safe-area inset so the home
  // indicator still gets its gap. `BottomTabBar` reads `style.height` only
  // to size itself and applies `paddingBottom: insets.bottom` on top.
  return (
    <BottomTabBar
      {...props}
      style={{ height: TOP_BAR_CONTENT_HEIGHT + props.insets.bottom }}
    />
  );
}
