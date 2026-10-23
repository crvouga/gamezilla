import {
  chessCmdNs,
  chessEvtNs,
  chessScreensCommandRouter,
  chessScreensEventReducer,
} from '@libs/chess-root-shared-ts/chess-screens';
import type { GameOwnRoom } from '@libs/spaces-shared-ts/game';
export const CHESS_GAME_ID = 'chess';

/**
 * The room behaviour of chess's own screens (what its review, settings and
 * developer screens have selected), installed beside the shared ones by
 * chess's registration. Its puzzles are the platform's puzzle session.
 * `@libs/spaces` knows nothing about chess.
 */
export const chessScreensRoom: GameOwnRoom = {
  commandRouters: [
    { namespace: chessCmdNs, router: chessScreensCommandRouter },
  ],
  eventRouters: [{ namespace: chessEvtNs, router: chessScreensEventReducer }],
};
