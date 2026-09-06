/**
 * Wide tab bar slot: no bottom tabs (header island owns nav). Mounts the
 * Spaces miniplayer on every tab (centered card at the bottom of the frame)
 * and reports layout height so screen insets stay valid.
 */

import { SpaceMiniplayer } from '@libs/spaces/root/client/miniplayer/space-miniplayer';
import { Box } from '@pkgs/ui-rn';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { type ReactNode, useCallback, useContext } from 'react';

export function AppTabBarBridgeWide(): ReactNode {
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
    </Box>
  );
}
