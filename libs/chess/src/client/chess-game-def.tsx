import type { GameClientDefinition } from '@libs/spaces/shared/game';
import { preloadChessBoardCanvas } from '@pkgs/chess-board/chess-board-canvas-runtime';
import { Trans } from '@lingui/react/macro';

import { CHESS_GAME_ID } from '../shared/chess-game';
import { ChessMainMenu } from './chess-main-menu';

/**
 * Client-side chess game registration. Listed in `@libs/games` and provided to
 * `<GamesRegistryProvider>` by `<GamesBootstrapFromPlugins>`, so the spaces UI
 * can mount chess without `@libs/spaces` knowing about chess.
 */
export const chessGameClient: GameClientDefinition = {
  id: CHESS_GAME_ID,
  title: <Trans>Chess</Trans>,
  MainMenu: ChessMainMenu,
  preload: () => {
    void preloadChessBoardCanvas();
  },
};
