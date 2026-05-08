import { useSpaceRoom } from '@gamezilla/client/spaces/room/use-space-room';
import {
  RoomClientsProvider,
  SPACE_ROOM_NAME,
  type AnyRoom,
} from '@gamezilla/room';
import { useMemo, type ReactNode } from 'react';

export type SpaceRoomProviderProps = {
  spaceId: string;
  children: ReactNode;
};

/**
 * Opens the space room connection and registers it under {@link SPACE_ROOM_NAME}
 * for {@link useSpaceSelector} / {@link useSpaceDispatch}.
 */
export function SpaceRoomProvider({
  spaceId,
  children,
}: SpaceRoomProviderProps): ReactNode {
  const state = useSpaceRoom(spaceId);
  const roomMap = useMemo((): ReadonlyMap<string, AnyRoom> | null => {
    if (state.room === null) return null;
    const m = new Map<string, AnyRoom>();
    m.set(SPACE_ROOM_NAME, state.room as AnyRoom);
    return m;
  }, [state.room]);
  return (
    <RoomClientsProvider rooms={roomMap}>{children}</RoomClientsProvider>
  );
}
