import {
  CHESS_SCREEN,
  ChessMainMenuScreenAttr,
  chessCmdNs,
  chessEvtNs,
  chessMainMenuCommandRouter,
  chessMainMenuEventReducer,
} from '@libs/chess-root-shared/chess-main-menu';
import type { GameDefinition } from '@libs/spaces-shared/game';
import type { RoomState } from '@pkgs/room-root-shared/types';
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
 * Server/shared chess game definition. Registered in `@libs/games` and composed
 * into the space `SpaceModule` at the composition root.
 *
 * Note: this is the *only* place chess wires itself into the spaces
 * registry. `@libs/spaces` knows nothing about chess.
 */
export const chessPuzzleGame: GameDefinition = {
  id: CHESS_GAME_ID,
  recoverEffects: () => [],
  commandRouters: [
    { namespace: chessCmdNs, router: chessMainMenuCommandRouter },
    { namespace: chessPuzzlePlayCmdNs, router: chessPuzzlePlayCommandRouter },
  ],
  eventRouters: [
    { namespace: chessEvtNs, router: chessMainMenuEventReducer },
    { namespace: chessPuzzlePlayEvtNs, router: chessPuzzlePlayEventReducer },
  ],
  initialState: chessPuzzlePlayInitialAttrs,
  resetRoomState(state: RoomState): RoomState {
    return {
      ...state,
      ...ChessMainMenuScreenAttr.screen(CHESS_SCREEN.root),
    };
  },
};
