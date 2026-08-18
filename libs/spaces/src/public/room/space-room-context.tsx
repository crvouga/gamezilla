import { type AnyRoom, RoomClientsProvider } from '@pkgs/room';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { SPACE_ROOM_MODULE_NAME } from '../../shared/space/space-room-module-name';
import { useSpaceOpenRoomEntry } from './space-open-rooms-context';

export type SpaceRoomProviderProps = {
  spaceId: string;
  children: ReactNode;
};

type SpaceRoomSession = {
  readonly spaceId: string;
  readonly clientId: string | null;
};

const SpaceRoomSessionContext = createContext<SpaceRoomSession | null>(null);

/** Per-tab client id for the open space room (stable across reconnects). */
export function useSpaceRoomClientId(): string | null {
  return useContext(SpaceRoomSessionContext)?.clientId ?? null;
}

/** Space id for the detail session (null outside {@link SpaceRoomProvider}). */
export function useSpaceRoomSessionId(): string | null {
  return useContext(SpaceRoomSessionContext)?.spaceId ?? null;
}

/**
 * Bridges the app-scoped open-space room into {@link SPACE_ROOM_NAME} for
 * detail UI. Does not open or destroy sockets — that is owned by
 * {@link SpaceOpenRoomsProvider}.
 */
export function SpaceRoomProvider({
  spaceId,
  children,
}: SpaceRoomProviderProps): ReactNode {
  const entry = useSpaceOpenRoomEntry(spaceId);
  const roomMap = useMemo((): ReadonlyMap<string, AnyRoom> | null => {
    if (entry === null) return null;
    const m = new Map<string, AnyRoom>();
    m.set(SPACE_ROOM_MODULE_NAME, entry.room as AnyRoom);
    return m;
  }, [entry]);
  const session = useMemo((): SpaceRoomSession => {
    return {
      spaceId,
      clientId: entry?.clientId ?? null,
    };
  }, [entry, spaceId]);
  return (
    <SpaceRoomSessionContext.Provider value={session}>
      <RoomClientsProvider rooms={roomMap}>{children}</RoomClientsProvider>
    </SpaceRoomSessionContext.Provider>
  );
}
