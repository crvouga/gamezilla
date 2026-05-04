import type { WebSocketRoomTransport } from '@gamezilla/room';
import { createContext, useContext } from 'react';

export type SpaceRoomWire = {
  transport: WebSocketRoomTransport | null;
  roomActive: boolean;
  roomSynced: boolean;
};

export const SpaceRoomWireContext = createContext<SpaceRoomWire>({
  transport: null,
  roomActive: false,
  roomSynced: false,
});

export function useSpaceRoomWire(): SpaceRoomWire {
  return useContext(SpaceRoomWireContext);
}
