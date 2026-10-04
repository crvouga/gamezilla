import { defineSystem } from '@pkgs/harness-shared/define-system';
import { bootRoomHarness, roomSystemCatalog } from '@pkgs/room-harness/boot';
import { ROOM_ARGS, ROOM_DRAW } from '@pkgs/room-harness/args';
import type { RoomApp } from '@pkgs/room-harness/scenario-app';
import type { RoomArgs } from '@pkgs/room-harness/args';
import type { RoomHarness } from '@pkgs/room-harness/harness';

import { createChessModule } from '@libs/chess-puzzle-shared/chess-module';

const ChessModule = createChessModule(() => 0);

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
