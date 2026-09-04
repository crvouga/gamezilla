import { defineSystem } from '@pkgs/dst';
import type { RoomApp, RoomArgs, RoomSurface } from '@pkgs/room/tests';
import {
  bootRoomSurface,
  ROOM_ARGS,
  ROOM_DRAW,
  registerRoomLibrary,
  roomVirtual,
} from '@pkgs/room/tests';

import { ChessModule } from '../chess-module';

/**
 * Minimal RoomApp for scripted chess puzzle pins. Domain arbs are empty —
 * pins add clients and dispatch module commands directly.
 */
export const chessApp: RoomApp = {
  module: ChessModule,
  domainOpArbs: () => [],
  toPayload: () => {
    throw new Error('chess system: scripted pins only');
  },
};

/** Chess puzzle room system: server + `clientCount` clients. */
export const chessSystem = defineSystem<RoomSurface, RoomArgs>({
  name: 'chess.puzzle',
  args: ROOM_ARGS,
  draw: ROOM_DRAW,
  create: (session, args) => bootRoomSurface(session, chessApp, args),
});
chessSystem.host({ default: true, name: 'virtual', create: roomVirtual });
registerRoomLibrary(chessSystem, chessApp);
