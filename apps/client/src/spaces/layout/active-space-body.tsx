import { SpaceGamePicker } from '@gamezilla/client/spaces/games/space-game-picker';
import { SpaceActiveLayout } from '@gamezilla/client/spaces/layout/space-active-layout';
import {
  SpaceSessionUiProvider,
  type SpaceSessionUiValue,
} from '@gamezilla/client/spaces/layout/space-session-ui-context';
import { Box } from '@gamezilla/lib/ui';
import { useMemo, type ReactNode } from 'react';

export type ActiveSpaceBodyProps = {
  spaceId: string;
  onRequestEnd: () => void;
  onRequestLeave: () => void;
  onPressHome: () => void;
  onPressDebug: () => void;
};

/**
 * Body of an active space session: chrome layout + game picker + counter
 * panel. Session UI is provided via {@link SpaceSessionUiProvider}; room state
 * uses registry hooks under {@link SpaceRoomProvider}.
 */
export function ActiveSpaceBody({
  spaceId,
  onRequestEnd,
  onRequestLeave,
  onPressHome,
  onPressDebug,
}: ActiveSpaceBodyProps): ReactNode {
  const sessionUi = useMemo(
    (): SpaceSessionUiValue => ({
      spaceId,
      onRequestEnd,
      onRequestLeave,
      onPressHome,
      onPressDebug,
    }),
    [spaceId, onRequestEnd, onRequestLeave, onPressHome, onPressDebug]
  );

  return (
    <SpaceSessionUiProvider value={sessionUi}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <SpaceActiveLayout>
          <SpaceGamePicker />
        </SpaceActiveLayout>
      </Box>
    </SpaceSessionUiProvider>
  );
}
