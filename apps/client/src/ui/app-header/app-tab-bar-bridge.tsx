/**
 * Tab bar slot for React Navigation's `Tabs` navigator.
 * Compact: bottom tabs + miniplayer. Wide: miniplayer only (header owns nav).
 */

import { useLayoutMode } from '@pkgs/ui-rn';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { ReactNode } from 'react';

import { AppTabBarBridgeCompact } from './app-tab-bar-bridge.compact';
import { AppTabBarBridgeWide } from './app-tab-bar-bridge.wide';

export function AppTabBarBridge(props: BottomTabBarProps): ReactNode {
  const mode = useLayoutMode();
  if (mode === 'wide') {
    return <AppTabBarBridgeWide />;
  }
  return <AppTabBarBridgeCompact {...props} />;
}
