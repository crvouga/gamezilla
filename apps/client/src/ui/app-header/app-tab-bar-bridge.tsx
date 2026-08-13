/**
 * Tab bar slot for React Navigation's `Tabs` navigator.
 */

import { SpaceMiniplayer } from '@libs/spaces/client/miniplayer/space-miniplayer';
import { Box } from '@pkgs/ui';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { ReactNode } from 'react';

import { AppTabBar } from './app-tab-bar';

export function AppTabBarBridge(props: BottomTabBarProps): ReactNode {
  return (
    <Box>
      <SpaceMiniplayer />
      <AppTabBar {...props} />
    </Box>
  );
}
