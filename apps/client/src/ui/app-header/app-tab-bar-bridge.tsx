/**
 * Tab bar slot for expo-router's `Tabs` navigator.
 */

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { SpaceMiniplayer } from '@libs/spaces/client/miniplayer/space-miniplayer';
import { Box } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { AppTabBar } from './app-tab-bar';

export function AppTabBarBridge(props: BottomTabBarProps): ReactNode {
  return (
    <Box>
      {/* eslint-disable-next-line lingui/no-unlocalized-strings -- internal slot id, not user-facing */}
      <SpaceMiniplayer slot="tabBar" />
      <AppTabBar {...props} />
    </Box>
  );
}
