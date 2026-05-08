import { SpaceActiveLayout } from '@gamezilla/client/spaces/layout/space-active-layout';
import { SpaceCounterPanel } from '@gamezilla/client/spaces/layout/space-counter-panel';
import { SpaceGamePicker } from '@gamezilla/client/spaces/layout/space-game-picker';
import { useSpaceRoomState } from '@gamezilla/client/spaces/room/space-room-context';
import { SpaceRoomWireContext } from '@gamezilla/client/spaces/room/space-room-wire-context';
import { useCurrentSpaceRole } from '@gamezilla/client/spaces/use-current-space-role';
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
 * panel. Pure layout — reads role/room state via context-backed hooks.
 */
export function ActiveSpaceBody({
  spaceId,
  onRequestEnd,
  onRequestLeave,
  onPressHome,
  onPressDebug,
}: ActiveSpaceBodyProps): ReactNode {
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';
  const room = useSpaceRoomState();

  const wire = useMemo(
    () => ({
      transport: room?.transport ?? null,
      roomActive: room?.roomActive ?? false,
      roomSynced: room?.isSynced ?? false,
    }),
    [room?.transport, room?.roomActive, room?.isSynced]
  );

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <SpaceRoomWireContext.Provider value={wire}>
        <SpaceActiveLayout
          spaceId={spaceId}
          isHost={isHost}
          onRequestEnd={onRequestEnd}
          onRequestLeave={onRequestLeave}
          onPressHome={onPressHome}
          onPressDebug={onPressDebug}
        >
          <SpaceGamePicker spaceId={spaceId} />
          <SpaceCounterPanel spaceId={spaceId} />
        </SpaceActiveLayout>
      </SpaceRoomWireContext.Provider>
    </Box>
  );
}
