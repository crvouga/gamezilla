import type { GameClientDefinition } from '@libs/spaces/public/game';
import { Trans } from '@lingui/react/macro';

import { CHESS_GAME_ID } from './chess-game';
import { ChessMainMenu } from './chess-main-menu-view';

/**
 * Client-side chess game registration. Listed in `@libs/games` and provided to
 * `<GamesRegistryProvider>` by `<GamesBootstrapFromPlugins>`, so the spaces UI
 * can mount chess without `@libs/spaces` knowing about chess.
 *
 * CanvasKit + the chess canvas chunk are warmed at app boot
 * (`LocalPaintLatch` → `preloadChessBoardCanvas`); the games picker does not
 * preload.
 */
export const chessGameClient: GameClientDefinition = {
  id: CHESS_GAME_ID,
  title: <Trans>Chess</Trans>,
  caption: <Trans>Puzzles, stats, and custom games</Trans>,
  MainMenu: ChessMainMenu,
};
