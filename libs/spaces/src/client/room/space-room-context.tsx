import { RoomClientsProvider, type AnyRoom } from '@pkgs/room';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useSpaceRoom } from './use-space-room';
import { SPACE_ROOM_NAME } from './use-space-room-selector';

export type SpaceRoomProviderProps = {
  spaceId: string;
  children: ReactNode;
};

type SpaceRoomSession = {
  readonly clientId: string;
};

const SpaceRoomSessionContext = createContext<SpaceRoomSession | null>(null);

/** Per-tab client id for the open space room (stable across reconnects). */
export function useSpaceRoomClientId(): string | null {
  return useContext(SpaceRoomSessionContext)?.clientId ?? null;
}

/**
 * Opens the space room connection and registers it under {@link SPACE_ROOM_NAME}
 * for {@link useSpaceRoomSelector} / {@link useSpaceRoomDispatch}.
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
  const session = useMemo(
    (): SpaceRoomSession => ({ clientId: state.clientId }),
    [state.clientId]
  );
  return (
    <SpaceRoomSessionContext.Provider value={session}>
      <RoomClientsProvider rooms={roomMap}>{children}</RoomClientsProvider>
    </SpaceRoomSessionContext.Provider>
  );
}
