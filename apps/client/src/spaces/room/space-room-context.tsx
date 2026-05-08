import { useSpaceRoom, type SpaceRoomUiState } from '@gamezilla/client/spaces/room/use-space-room';
import { createContext, useContext, type ReactNode } from 'react';

const SpaceRoomContext = createContext<SpaceRoomUiState | null>(null);

export type SpaceRoomProviderProps = {
  spaceId: string;
  children: ReactNode;
};

/**
 * Hosts a single {@link useSpaceRoom} subscription for `spaceId` and exposes
 * the resulting room state to descendants via context. Atoms inside the tree
 * read shared room state with {@link useSpaceRoomState} so we never open more
 * than one transport per space.
 */
export function SpaceRoomProvider({
  spaceId,
  children,
}: SpaceRoomProviderProps): ReactNode {
  const state = useSpaceRoom(spaceId);
  return (
    <SpaceRoomContext.Provider value={state}>
      {children}
    </SpaceRoomContext.Provider>
  );
}

export function useSpaceRoomState(): SpaceRoomUiState | null {
  return useContext(SpaceRoomContext);
}
