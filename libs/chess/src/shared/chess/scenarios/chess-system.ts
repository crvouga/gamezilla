import type { RoomApp, RoomArgs, RoomSim } from '@pkgs/room/sim';
import {
  bootRoomSim,
  ROOM_ARGS,
  ROOM_DRAW,
  registerRoomLibrary,
  roomVirtual,
} from '@pkgs/room/sim';
import { defineSystem } from '@pkgs/sim';

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
export const chessSystem = defineSystem<RoomSim, RoomArgs>({
  name: 'chess.puzzle',
  args: ROOM_ARGS,
  sample: ROOM_DRAW,
  create: (session, args) => bootRoomSim(session, chessApp, args),
});
chessSystem.runtime({ default: true, name: 'virtual', create: roomVirtual });
registerRoomLibrary(chessSystem, chessApp);
