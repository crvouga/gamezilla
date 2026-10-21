import { createChessModule } from '@libs/chess-puzzle-harness-ts/chess-module';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { RoomArgs } from '@pkgs/room-root-harness-ts/args';
import { ROOM_ARGS, ROOM_DRAW } from '@pkgs/room-root-harness-ts/args';
import {
  bootRoomHarness,
  roomSystemCatalog,
} from '@pkgs/room-root-harness-ts/boot';
import type { RoomHarness } from '@pkgs/room-root-harness-ts/harness';
import type { RoomApp } from '@pkgs/room-root-harness-ts/scenario-app';

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
