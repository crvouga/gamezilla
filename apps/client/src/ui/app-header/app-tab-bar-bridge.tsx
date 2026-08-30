/**
 * Tab bar slot for React Navigation's `Tabs` navigator.
 * Miniplayer only mounts on the Spaces tab.
 */

import { SpaceMiniplayer } from '@libs/spaces/root/client/miniplayer/space-miniplayer';
import { Box } from '@pkgs/ui';
import {
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { type ReactNode, useCallback, useContext } from 'react';

import { AppTabBar } from './app-tab-bar';

export function AppTabBarBridge(props: BottomTabBarProps): ReactNode {
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const reportLayout = useCallback(
    (height: number) => {
      onHeightChange?.(height);
    },
    [onHeightChange]
  );
  const onSpaces = props.state.routes[props.state.index]?.name === 'Spaces';

  return (
    <Box
      onLayout={(e) => {
        reportLayout(e.nativeEvent.layout.height);
      }}
    >
      {onSpaces ? <SpaceMiniplayer /> : null}
      <AppTabBar {...props} />
    </Box>
  );
}
