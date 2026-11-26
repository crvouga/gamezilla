import { chessPuzzlesClient } from '@libs/chess-puzzle-client-ts/chess-puzzles-client';
import { chessGameShared } from '@libs/chess-sub-shared-ts/chess-game';
import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { chessPresentation } from './chess-game-presentation';
import { chessLesson } from './chess-lesson';

/**
 * Chess contributes its board, notation, themes, sounds and puzzle coach.
 */
export const chessGameClient = defineGameClient({
  shared: chessGameShared,
  title: 'Chess',
  caption: 'Puzzles, stats, and custom games',
  tile: 'checkered',
  subtitle: () => <Trans>Choose how you want to play.</Trans>,
  lesson: chessLesson,
  presentation: chessPresentation,
  puzzles: chessPuzzlesClient,
});
