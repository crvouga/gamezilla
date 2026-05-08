import { useSpaceRoomState } from '@gamezilla/client/spaces/space-room-context';
import { JsonView } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

/** Room snapshot for the space debug modal. */
export function SpaceDebugRoomSection(): ReactNode {
  const room = useSpaceRoomState();
  const value =
    room === null
      ? { roomActive: false, isSynced: false, count: 0, selectedGame: null }
      : {
          roomActive: room.roomActive,
          isSynced: room.isSynced,
          count: room.count,
          selectedGame: room.selectedGame,
        };
  return <JsonView label={<Trans>room</Trans>} value={value} />;
}
