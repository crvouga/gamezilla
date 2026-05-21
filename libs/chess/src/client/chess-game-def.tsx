import type { GameClientDefinition } from '@libs/spaces/shared/game';
import { Trans } from '@lingui/react/macro';

import { CHESS_GAME_ID } from '../shared/chess-game';
import { ChessMainMenu } from './chess-main-menu';

/**
 * Client-side chess game registration. Wired into `<GamesRegistryProvider>`
 * at the composition root (`apps/client/src/app/_layout.tsx`) so the
 * spaces UI can mount chess without `@libs/spaces` knowing about chess.
 */
export const chessGameClient: GameClientDefinition = {
  id: CHESS_GAME_ID,
  title: <Trans>Chess</Trans>,
  MainMenu: ChessMainMenu,
};
