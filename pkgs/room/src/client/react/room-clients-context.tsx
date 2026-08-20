import { createContext, type ReactNode, useContext } from 'react';

import type { RoomCommandPayload, RoomEvent, RoomState } from '../../types';
import type { RoomClient } from '../core/room-client';

/** Type-erased room client instance for multi-room React registries. */
export type AnyRoomClient = RoomClient<
  RoomState,
  RoomCommandPayload,
  RoomEvent,
  unknown
>;

const EMPTY_MAP: ReadonlyMap<string, AnyRoomClient> = new Map();

const RoomClientsContext =
  createContext<ReadonlyMap<string, AnyRoomClient>>(EMPTY_MAP);

export type RoomClientsProviderProps = {
  /** Map of logical room name → open {@link RoomClient}. Pass `null` when none. */
  rooms: ReadonlyMap<string, AnyRoomClient> | null;
  children: ReactNode;
};

/**
 * Supplies named {@link RoomClient} instances to {@link useRoomSelector} /
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

export function useRoomFromRegistry(roomName: string): AnyRoomClient | null {
  const map = useContext(RoomClientsContext);
  return map.get(roomName) ?? null;
}
