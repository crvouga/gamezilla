import { Box } from '@pkgs/ui-rn';
import { type ReactNode, useMemo } from 'react';

import { GamesMainMenu } from '../module/games-main-menu';
import { useAnnounceJoinedOnSync } from '../room/use-announce-joined-on-sync';
import { SpaceActiveLayout } from './space-active-layout';
import {
  SpaceSessionUiProvider,
  type SpaceSessionUiValue,
} from './space-session-ui-context';

export type ActiveSpaceBodyProps = {
  spaceId: string;
  onRequestEnd: () => void;
  onRequestLeave: () => void;
  onRequestRename: () => void;
  onPressHome: () => void;
};

/**
 * Body of an active space session: chrome layout + games main menu. Session
 * UI is provided via {@link SpaceSessionUiProvider}; room state uses registry
 * hooks under {@link SpaceRoomProvider}.
 */
export function ActiveSpaceBody({
  spaceId,
  onRequestEnd,
  onRequestLeave,
  onRequestRename,
  onPressHome,
}: ActiveSpaceBodyProps): ReactNode {
  useAnnounceJoinedOnSync(spaceId);
  const sessionUi = useMemo(
    (): SpaceSessionUiValue => ({
      spaceId,
      onRequestEnd,
      onRequestLeave,
      onRequestRename,
      onPressHome,
    }),
    [spaceId, onRequestEnd, onRequestLeave, onRequestRename, onPressHome]
  );

  return (
    <SpaceSessionUiProvider value={sessionUi}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <SpaceActiveLayout>
          <GamesMainMenu />
        </SpaceActiveLayout>
      </Box>
    </SpaceSessionUiProvider>
  );
}
