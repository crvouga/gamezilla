import type { WebSocketRoomTransport } from '@gamezilla/room';
import { createContext, useContext } from 'react';

export type SpaceRoomWire = {
  transport: WebSocketRoomTransport | null;
  sessionPeerId: string | null;
};

export const SpaceRoomWireContext = createContext<SpaceRoomWire>({
  transport: null,
  sessionPeerId: null,
});

export function useSpaceRoomWire(): SpaceRoomWire {
  return useContext(SpaceRoomWireContext);
}
