import { createContext, useContext, type ReactNode } from 'react';

import type { RoomCommandPayload, RoomEvent, RoomState } from '../../types';
import type { Room } from '../core/room';

/**
 * Default registry key for the primary collaborative room in a space session.
 * Apps may register additional names for multi-room UIs.
 */
export const SPACE_ROOM_NAME = 'space';

/** Type-erased room instance for multi-room React registries. */
export type AnyRoom = Room<RoomState, RoomCommandPayload, RoomEvent, unknown>;

const EMPTY_MAP: ReadonlyMap<string, AnyRoom> = new Map();

const RoomClientsContext =
  createContext<ReadonlyMap<string, AnyRoom>>(EMPTY_MAP);

export type RoomClientsProviderProps = {
  /** Map of logical room name → open {@link Room}. Pass `null` when none. */
  rooms: ReadonlyMap<string, AnyRoom> | null;
  children: ReactNode;
};

/**
 * Supplies named {@link Room} clients to {@link useRoomSelector} /
 * {@link useRoomDispatch} descendants.
 */
export function RoomClientsProvider({
  rooms,
  children,
}: RoomClientsProviderProps): ReactNode {
  const value = rooms ?? EMPTY_MAP;
  return (
    <RoomClientsContext.Provider value={value}>
      {children}
    </RoomClientsContext.Provider>
  );
}

export function useRoomFromRegistry(roomName: string): AnyRoom | null {
  const map = useContext(RoomClientsContext);
  return map.get(roomName) ?? null;
}
