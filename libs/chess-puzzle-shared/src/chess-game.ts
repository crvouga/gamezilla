import {
  chessCmdNs,
  chessEvtNs,
  chessScreensCommandRouter,
  chessScreensEventReducer,
} from '@libs/chess-root-shared/chess-screens';
import {
  puzzlePlayCmdNs,
  puzzlePlayEvtNs,
} from '@libs/game-puzzle-shared/play-messages';
import {
  puzzlePlayEventReducer,
  puzzlePlayInitialAttrs,
} from '@libs/game-puzzle-shared/play-reducer';
import type { GameOwnRoom } from '@libs/spaces-shared/game';
import { chessPuzzlePlayCommandRouter } from './chess-puzzle-play-router';
export const CHESS_GAME_ID = 'chess';

/**
 * The room behaviour of chess's own screens (its puzzles and the screens
 * they open), installed beside the shared ones by chess's registration.
 * `@libs/spaces` knows nothing about chess.
 */
export const chessPuzzleRoom: GameOwnRoom = {
  commandRouters: [
    { namespace: chessCmdNs, router: chessScreensCommandRouter },
    { namespace: puzzlePlayCmdNs, router: chessPuzzlePlayCommandRouter },
  ],
  eventRouters: [
    { namespace: chessEvtNs, router: chessScreensEventReducer },
    { namespace: puzzlePlayEvtNs, router: puzzlePlayEventReducer },
  ],
  initialState: puzzlePlayInitialAttrs,
};
