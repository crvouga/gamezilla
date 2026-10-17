import {
  chessCmdNs,
  chessEvtNs,
  chessScreensCommandRouter,
  chessScreensEventReducer,
} from '@libs/chess-root-shared/chess-screens';
import type { GameOwnRoom } from '@libs/spaces-shared/game';
import {
  chessPuzzlePlayCmdNs,
  chessPuzzlePlayEvtNs,
} from './chess-puzzle-play-messages';
import {
  chessPuzzlePlayEventReducer,
  chessPuzzlePlayInitialAttrs,
} from './chess-puzzle-play-reducer';
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
    { namespace: chessPuzzlePlayCmdNs, router: chessPuzzlePlayCommandRouter },
  ],
  eventRouters: [
    { namespace: chessEvtNs, router: chessScreensEventReducer },
    { namespace: chessPuzzlePlayEvtNs, router: chessPuzzlePlayEventReducer },
  ],
  initialState: chessPuzzlePlayInitialAttrs,
};
