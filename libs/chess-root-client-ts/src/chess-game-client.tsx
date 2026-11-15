import { chessPuzzlesClient } from '@libs/chess-puzzle-client-ts/chess-puzzles-client';
import { chessGameShared } from '@libs/chess-sub-shared-ts/chess-game';
import {
  defineGameClient,
  type GameRule,
} from '@libs/game-menu-client-ts/game-client';
import { Trans } from '@lingui/solid/macro';
import { chessPresentation } from './chess-game-presentation';
import {
  CASTLING_EXAMPLE,
  EN_PASSANT_EXAMPLE,
  KNIGHT_EXAMPLE,
} from './chess-rule-examples';
import { chessSettings } from './chess-settings';

/** Chess's rules, part by part, the spatial ones pictured on boards. */
export const CHESS_RULES: readonly GameRule[] = [
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
        White moves first, then the sides take turns moving one piece. Land on
        another's piece to take it; you may never leave your own king in check.
      </Trans>
    ),
    points: [
      () => <Trans>♚ King: one square in any direction.</Trans>,
      () => (
        <Trans>♛ Queen: any distance in a straight line or diagonal.</Trans>
      ),
      () => <Trans>♜ Rook: any distance in a straight line.</Trans>,
      () => <Trans>♝ Bishop: any distance diagonally.</Trans>,
      () => (
        <Trans>
          ♞ Knight: an L, two squares one way and one to the side, jumping over
          pieces.
        </Trans>
      ),
      () => (
        <Trans>
          ♟ Pawn: one square forward, or two from its start; it takes one square
          diagonally forward.
        </Trans>
      ),
    ],
    examples: [KNIGHT_EXAMPLE],
  },
  {
    key: 'special',
    title: () => <Trans>Special moves</Trans>,
    body: () => <Trans>Three moves break the usual pattern.</Trans>,
    points: [
      () => (
        <Trans>
          Castling: the king moves two squares toward a rook, which jumps to its
          other side. Neither may have moved, and the king may not be in, pass
          through or land in check.
        </Trans>
      ),
      () => (
        <Trans>
          Promotion: a pawn that reaches the last row becomes a queen, rook,
          bishop or knight.
        </Trans>
      ),
      () => (
        <Trans>
          En passant: a pawn that just moved two squares may be taken as if it
          had moved one, on the next move only.
        </Trans>
      ),
    ],
    examples: [CASTLING_EXAMPLE, EN_PASSANT_EXAMPLE],
  },
  {
    key: 'end',
    title: () => <Trans>The end</Trans>,
    body: () => (
      <Trans>
        Checkmate wins. A side with no legal move that is not in check is
        stalemated, and the game is drawn.
      </Trans>
    ),
  },
];

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
  instructions: CHESS_RULES,
});
