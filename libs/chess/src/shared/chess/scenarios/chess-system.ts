import type { RoomApp, RoomSystemDef } from '@pkgs/room/tests';
import { defineRoomSystem, domainOp } from '@pkgs/room/tests';
import type { SeededRng } from '@pkgs/uuid';

import { ChessModule } from '../chess-module';

/**
 * Minimal RoomApp for scripted chess puzzle pins. Domain arbs are empty —
 * pins add clients and dispatch module commands directly.
 */
export const chessApp: RoomApp = {
  module: ChessModule,
  domainOpArbs: () => [],
  pickDomainOp: (_rng: SeededRng, clientIds) =>
    domainOp(clientIds[0] ?? 'c0', 'noop'),
  toPayload: () => {
    throw new Error('chess system: scripted pins only');
  },
};

export const chessSystem: RoomSystemDef = defineRoomSystem(chessApp, {
  id: 'chess.puzzle',
});
