import type { GameDefinition } from '@gamezilla/spaces/shared/game';
import type { RoomState } from '@gamezilla/room';

import {
  CHESS_SCREEN,
  ChessMainMenuScreenAttr,
  chessCmdNs,
  chessEvtNs,
  chessMainMenuCommandRouter,
  chessMainMenuEventReducer,
} from './chess-main-menu';
import {
  chessPuzzlePlayCmdNs,
  chessPuzzlePlayCommandRouter,
  chessPuzzlePlayEventReducer,
  chessPuzzlePlayEvtNs,
  chessPuzzlePlayInitialAttrs,
} from './chess-puzzle-play';
export const CHESS_GAME_ID = 'chess';

/**
 * Server/shared chess game definition. Registered into the composed
 * `SpaceModule` at the composition root (`APP_SPACE_MODULE` from `@gamezilla/app/shared/games`).
 *
 * Note: this is the *only* place chess wires itself into the spaces
 * registry. `@gamezilla/spaces` knows nothing about chess.
 */
export const chessGameShared: GameDefinition = {
  id: CHESS_GAME_ID,
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
