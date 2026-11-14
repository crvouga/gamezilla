import { chessPuzzlesClient } from '@libs/chess-puzzle-client-ts/chess-puzzles-client';
import { chessGameShared } from '@libs/chess-sub-shared-ts/chess-game';
import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { Trans } from '@lingui/solid/macro';
import { chessPresentation } from './chess-game-presentation';
import { chessSettings } from './chess-settings';

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
  subtitle: () => (
    <Trans>Checkmate the king. Every piece moves its own way.</Trans>
  ),
  presentation: chessPresentation,
  puzzles: chessPuzzlesClient,
  settings: chessSettings,
  instructions: [
    {
      key: 'goal',
      title: () => <Trans>Goal</Trans>,
      body: () => (
        <Trans>
          Checkmate the other king: attack it so that no move saves it.
        </Trans>
      ),
    },
    {
      key: 'turn',
      title: () => <Trans>Your turn</Trans>,
      body: () => (
        <Trans>
          White moves first, then the sides take turns moving one piece. A king
          steps one square any way, a queen any distance in a line, a rook
          straight, a bishop diagonally, a knight in an L that jumps over
          pieces, and a pawn one square forward (two from its start), taking one
          square diagonally forward. Land on another's piece to take it.
        </Trans>
      ),
    },
    {
      key: 'special',
      title: () => <Trans>Special moves</Trans>,
      body: () => (
        <Trans>
          Castle by moving the king two squares toward a rook that jumps to its
          other side, when neither has moved and the king is not in, through or
          into check. A pawn that reaches the last row becomes a queen, rook,
          bishop or knight. A pawn that just moved two squares may be taken in
          passing, on the next move only.
        </Trans>
      ),
    },
    {
      key: 'end',
      title: () => <Trans>The end</Trans>,
      body: () => (
        <Trans>
          You may never leave your own king in check. Checkmate wins; a side
          with no legal move and not in check is stalemated, and the game is
          drawn.
        </Trans>
      ),
    },
  ],
});
