import type { GameRuleExample } from '@libs/game-menu-client-ts/game-client';
import { Trans } from '@lingui/solid/macro';
import type {
  BoardArrow,
  CellHighlight,
  Square,
} from '@pkgs/chess-board-core-shared-ts/types';
import { ChessBoard } from '@pkgs/chess-board-root-client-ts/chess-board';
import type { JSX } from 'solid-js';

/**
 * Chess's rules in play: small still boards beside the words, each showing
 * one move as arrows and the squares it reaches, for the parts whose moves
 * are hard to picture from words alone.
 */

/**
 * Each example's position. Every one is a legal position (both kings on
 * the board): the board draws the opening position for any other.
 */
export const RULE_EXAMPLE_POSITIONS = {
  knight: '4k3/8/8/3p4/3N4/8/8/4K3 w - - 0 1',
  castling: '4k3/8/8/8/8/8/8/4K2R w K - 0 1',
  enPassant: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
} as const;

// The accent, as every board marks a square it means.
const MARK: CellHighlight = {
  color: 'var(--ui-color-tint-active)',
  opacity: 0.45,
};

/** A still board of `fen`, `arrows` drawn and `marked` squares tinted. */
function RuleBoard(props: {
  fen: string;
  arrows?: readonly BoardArrow[];
  marked?: readonly Square[];
}): JSX.Element {
  return (
    <ChessBoard
      fen={props.fen}
      size={200}
      interactive={false}
      sound={false}
      animations={false}
      arrows={props.arrows}
      cellHighlights={Object.fromEntries(
        (props.marked ?? []).map((square) => [square, MARK])
      )}
    />
  );
}

const KNIGHT_TARGETS: readonly Square[] = [
  'b3',
  'b5',
  'c2',
  'c6',
  'e2',
  'e6',
  'f3',
  'f5',
];

/** The knight's L, from d4 to every square it reaches, past a pawn on d5. */
export const KNIGHT_EXAMPLE: GameRuleExample = {
  key: 'knight',
  Figure: () => (
    <RuleBoard
      fen={RULE_EXAMPLE_POSITIONS.knight}
      arrows={[{ from: 'd4', to: 'e6' }]}
      marked={KNIGHT_TARGETS}
    />
  ),
  caption: () => (
    <Trans>
      The knight on d4 reaches every marked square, jumping over the pawn.
    </Trans>
  ),
};

/** White castles short: the king two squares right, the rook over it. */
export const CASTLING_EXAMPLE: GameRuleExample = {
  key: 'castling',
  Figure: () => (
    <RuleBoard
      fen={RULE_EXAMPLE_POSITIONS.castling}
      arrows={[
        { from: 'e1', to: 'g1' },
        { from: 'h1', to: 'f1', color: 'secondary' },
      ]}
    />
  ),
  caption: () => (
    <Trans>Castling: the king goes e1 to g1, the rook h1 to f1.</Trans>
  ),
};

/** Black's pawn has just moved d7 to d5; White's pawn takes it in passing. */
export const EN_PASSANT_EXAMPLE: GameRuleExample = {
  key: 'en-passant',
  Figure: () => (
    <RuleBoard
      fen={RULE_EXAMPLE_POSITIONS.enPassant}
      arrows={[{ from: 'e5', to: 'd6' }]}
      marked={['d5']}
    />
  ),
  caption: () => (
    <Trans>
      En passant: Black's pawn just moved d7 to d5; White's pawn on e5 takes it
      by moving to d6.
    </Trans>
  ),
};
