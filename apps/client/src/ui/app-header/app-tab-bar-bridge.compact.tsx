/**
 * Compact tab bar slot: Spaces miniplayer (pinned above the tabs on every
 * tab) + bottom tabs.
 */

import { SpaceMiniplayer } from '@libs/spaces/root/client/miniplayer/space-miniplayer';
import { Box } from '@pkgs/ui-rn';
import {
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { type ReactNode, useCallback, useContext } from 'react';

import { AppTabBar } from './app-tab-bar';

export function AppTabBarBridgeCompact(props: BottomTabBarProps): ReactNode {
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const reportLayout = useCallback(
    (height: number) => {
      onHeightChange?.(height);
    },
    [onHeightChange]
  );

  return (
    <Box
      onLayout={(e) => {
        reportLayout(e.nativeEvent.layout.height);
      }}
    >
      <SpaceMiniplayer />
      <AppTabBar {...props} />
    </Box>
  );
}
