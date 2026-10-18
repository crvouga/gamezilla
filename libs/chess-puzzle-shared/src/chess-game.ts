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
import { createPuzzlePlayCommandRouter } from '@libs/game-puzzle-shared/play-router';
import type { GameOwnRoom } from '@libs/spaces-shared/game';
import { CHESS_PUZZLE_GAME } from './chess-puzzles';
export const CHESS_GAME_ID = 'chess';

/**
 * The room behaviour of chess's own screens (its puzzles and the screens
 * they open), installed beside the shared ones by chess's registration.
 * `@libs/spaces` knows nothing about chess.
 */
export const chessPuzzleRoom: GameOwnRoom = {
  commandRouters: [
    { namespace: chessCmdNs, router: chessScreensCommandRouter },
    {
      namespace: puzzlePlayCmdNs,
      // The platform's puzzle session, over chess alone until puzzles are a
      // capability chess declares.
      router: createPuzzlePlayCommandRouter((position) =>
        CHESS_PUZZLE_GAME.rules.recognizes(position) ? CHESS_PUZZLE_GAME : null
      ),
    },
  ],
  eventRouters: [
    { namespace: chessEvtNs, router: chessScreensEventReducer },
    { namespace: puzzlePlayEvtNs, router: puzzlePlayEventReducer },
  ],
  initialState: puzzlePlayInitialAttrs,
};
