/**
 * Rules port for {@link BoardInteraction}: either a live {@link ChessGame}
 * or a controlled dests map from the parent.
 */

import type { ChessGame, MoveInput, TryMoveResult } from './game';
import { indexFromSquare } from './geometry';
import type { PieceColor, Position, Square } from './types';

export type BoardRulesPort = {
  readonly getTurn: () => PieceColor;
  readonly getPosition: () => Position;
  readonly ownsMovable: (square: Square) => boolean;
  readonly isPremovable: (
    square: Square,
    player: PieceColor | null,
    premovesEnabled: boolean
  ) => boolean;
  readonly legalTargetsFrom: (square: Square) => readonly Square[];
  readonly premoveTargetsFrom: (square: Square) => readonly Square[];
  readonly moveRequiresPromotion: (from: Square, to: Square) => boolean;
  readonly tryMove: (move: MoveInput) => TryMoveResult;
};

const EMPTY: readonly Square[] = Object.freeze([]);

/** Adapt {@link ChessGame} to the interaction rules port. */
export function chessGameRules(game: ChessGame): BoardRulesPort {
  return {
    getTurn: () => game.getSnapshot().turn,
    getPosition: () => game.getSnapshot().position,
    ownsMovable(square) {
      const { position, turn, isGameOver } = game.getSnapshot();
      return !isGameOver && position[indexFromSquare(square)]?.color === turn;
    },
    isPremovable(square, player, premovesEnabled) {
      if (!premovesEnabled || player === null) return false;
      const { position, turn } = game.getSnapshot();
      if (game.getSnapshot().isGameOver || turn === player) return false;
      const piece = position[indexFromSquare(square)];
      return piece !== null && piece !== undefined && piece.color === player;
    },
    legalTargetsFrom: (square) => game.legalMovesFrom(square),
    premoveTargetsFrom: (square) => game.premoveTargetsFrom(square),
    moveRequiresPromotion: (from, to) => game.moveRequiresPromotion(from, to),
    tryMove: (move) => game.tryMove(move),
  };
}

export type ControlledDests = ReadonlyMap<Square, readonly Square[]>;

export type ControlledRulesArgs = {
  readonly position: () => Position;
  readonly turn: () => PieceColor;
  readonly movableColor: () => PieceColor | 'both' | null;
  readonly dests: () => ControlledDests;
  readonly premoveDests?: () => ControlledDests;
  readonly onTryMove: (move: MoveInput) => TryMoveResult;
  readonly requiresPromotion?: (from: Square, to: Square) => boolean;
};

/** Parent-owned dests + position; moves are intents via `onTryMove`. */
export function controlledRules(args: ControlledRulesArgs): BoardRulesPort {
  const colorOk = (square: Square): boolean => {
    const movable = args.movableColor();
    if (movable === null) return false;
    const piece = args.position()[indexFromSquare(square)];
    if (piece === null || piece === undefined) return false;
    return movable === 'both' || piece.color === movable;
  };
  return {
    getTurn: () => args.turn(),
    getPosition: () => args.position(),
    ownsMovable: (square) => colorOk(square),
    isPremovable(square, player, premovesEnabled) {
      if (!premovesEnabled || player === null) return false;
      if (args.turn() === player) return false;
      const piece = args.position()[indexFromSquare(square)];
      return piece !== null && piece !== undefined && piece.color === player;
    },
    legalTargetsFrom: (square) => args.dests().get(square) ?? EMPTY,
    premoveTargetsFrom: (square) =>
      (args.premoveDests ?? args.dests)().get(square) ?? EMPTY,
    moveRequiresPromotion: (from, to) =>
      args.requiresPromotion?.(from, to) ?? false,
    tryMove: (move) => args.onTryMove(move),
  };
}
