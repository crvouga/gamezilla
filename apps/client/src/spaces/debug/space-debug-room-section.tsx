import { useSpaceSelector } from '@gamezilla/client/spaces/room/use-space-room-selector';
import {
  CounterRoomAttr,
  GamesRoomAttr,
} from '@gamezilla/domain/spaces/space-module';
import {
  RoomMetaAttr,
  SPACE_ROOM_NAME,
  useRoomFromRegistry,
} from '@gamezilla/room';
import { JsonView } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

/** Room snapshot for the space debug modal. */
export function SpaceDebugRoomSection(): ReactNode {
  const room = useRoomFromRegistry(SPACE_ROOM_NAME);
  const roomActive = room !== null;
  const count = useSpaceSelector(CounterRoomAttr.count.from);
  const selectedGame = useSpaceSelector(GamesRoomAttr.selected.from);
  const isSynced = useSpaceSelector(RoomMetaAttr.isSynced.from);
  const value = {
    roomActive,
    isSynced,
    count,
    selectedGame,
  };
  return <JsonView label={<Trans>room</Trans>} value={value} />;
}
