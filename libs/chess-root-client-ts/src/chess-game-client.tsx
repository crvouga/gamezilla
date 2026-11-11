import { chessPuzzlesClient } from '@libs/chess-puzzle-client-ts/chess-puzzles-client';
import { chessSettings } from '@libs/chess-shared-client-ts/chess-settings';
import { chessGameShared } from '@libs/chess-sub-shared-ts/chess-game';
import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { Trans } from '@lingui/solid/macro';
import { chessPresentation } from './chess-game-presentation';

/**
 * Chess's client: its board and copy, its puzzles part (board, coach,
 * themes, notation, sounds) and its settings, declared as data. Every
 * screen (puzzle, puzzle stats, custom game, opponent, history, settings
 * and the puzzle loader behind them) is the platform's.
 */
export const chessGameClient = defineGameClient({
  shared: chessGameShared,
  title: 'Chess',
  caption: 'Puzzles, stats, and custom games',
  tile: 'checkered',
  subtitle: () => <Trans>Choose how you want to play.</Trans>,
  presentation: chessPresentation,
  puzzles: chessPuzzlesClient,
  settings: chessSettings,
});
