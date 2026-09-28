import { defineSystem } from '@pkgs/harness';
import {
  bootRoomHarness,
  ROOM_ARGS,
  ROOM_DRAW,
  type RoomApp,
  type RoomArgs,
  type RoomHarness,
  roomSystemCatalog,
} from '@pkgs/room-harness';

import { ChessModule } from '../shared/chess/chess-module';

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
export const chessSystem = defineSystem<RoomHarness, RoomArgs>({
  name: 'chess.puzzle',
  args: ROOM_ARGS,
  sample: ROOM_DRAW,
  create: (session, args) => bootRoomHarness(session, chessApp, args),
  ...roomSystemCatalog(chessApp),
});
