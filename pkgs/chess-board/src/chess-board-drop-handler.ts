import { indexFromSquare } from './chess-board-geometry';
import {
  hapticError,
  hapticSelection,
  hapticSuccess,
} from './chess-board-haptics';
import type { ChessBoardSounds } from './chess-board-sounds';
import type { Move, PieceColor, Position, Square } from './chess-board-types';
import type { useChessBoardApplyMoveSound } from './use-chess-board-apply-move-sound';
import type { PendingPromotion } from './use-chess-board-interaction-state';
import type { TryMoveOk, TryMoveResult, useChessGame } from './use-chess-game';

type GameLike = ReturnType<typeof useChessGame>;
type ApplyMoveSoundLike = ReturnType<typeof useChessBoardApplyMoveSound>;

/**
 * Applies the ply to the live `useChessGame` instance so `lastMove` +
 * `position` feed `useChessPieceRows` / piece slide animations. On
 * controlled boards, `useExternalFenSync` keeps the live instance in
 * lock-step with `rulesFen` via `useLayoutEffect` (sync runs before
 * paint, so any drop the user can possibly trigger sees a fresh
 * instance), which makes the previous throwaway `tryMoveOnFen(rulesFen)`
 * dry-run pure waste — `new Chess(fen)` + a second move scan per drop.
 */
export function applyPlyForBoardUi(
  _rulesFen: string | undefined,
  tryMove: GameLike['tryMove'],
  m: { from: Square; to: Square; promotion?: Move['promotion'] }
): TryMoveResult {
  return tryMove(m);
}

function hapticForMove(move: Move, inCheck: boolean): void {
  if (move.captured || inCheck) {
    hapticSuccess();
  } else {
    hapticSelection();
  }
}

export type DropAttemptArgs = {
  fromSq: Square;
  toSq: Square;
  rulesFen: string | undefined;
  position: Position;
  turn: PieceColor;
  game: GameLike;
  sounds: ChessBoardSounds;
  applySuccessfulMove: ApplyMoveSoundLike;
  onMove: ((m: Move) => void) | undefined;
  setPendingPromotion: (p: PendingPromotion | null) => void;
};

export type DropApplied = {
  kind: 'applied';
  result: TryMoveOk;
};

export type DropOutcome =
  | { kind: 'promotion' }
  | { kind: 'illegal' }
  | DropApplied;

/**
 * Mutates chess rules + returns outcome WITHOUT committing React UI state.
 * Caller snaps SharedValues immediately, then schedules `commitDropUi`.
 */
export function applyDropRules(args: DropAttemptArgs): DropOutcome {
  const { fromSq, toSq, position, turn, game, sounds, setPendingPromotion } =
    args;
  if (game.moveRequiresPromotion(fromSq, toSq)) {
    const moverColor = position[indexFromSquare(fromSq)]?.color ?? turn;
    setPendingPromotion({ from: fromSq, to: toSq, color: moverColor });
    return { kind: 'promotion' };
  }
  const res = game.tryMoveSilent({ from: fromSq, to: toSq });
  if (!res.ok) {
    sounds.playIllegal();
    hapticError();
    return { kind: 'illegal' };
  }
  return { kind: 'applied', result: res };
}

/** React + audio + parent notify — schedule AFTER pointer-up returns. */
export function commitDropUi(args: DropAttemptArgs, result: TryMoveOk): void {
  args.game.commitMoveUi(result.move);
  hapticForMove(result.move, result.inCheck);
  args.applySuccessfulMove(result.move, {
    inCheck: result.inCheck,
    isGameOver: result.isGameOver,
  });
  args.onMove?.(result.move);
}

/** Routes a piece drop: promotion → open picker; otherwise apply + audio + haptic.
 * Returns true when the ply applied or a promotion picker was opened. */
export function handleDropAttempt(args: DropAttemptArgs): boolean {
  const outcome = applyDropRules(args);
  if (outcome.kind === 'promotion') return true;
  if (outcome.kind === 'illegal') return false;
  commitDropUi(args, outcome.result);
  return true;
}

export type HandlePromotionPickArgs = {
  pending: PendingPromotion;
  promotion: NonNullable<Move['promotion']>;
  rulesFen: string | undefined;
  game: GameLike;
  sounds: ChessBoardSounds;
  applySuccessfulMove: ApplyMoveSoundLike;
  onMove: ((m: Move) => void) | undefined;
  setPendingPromotion: (next: PendingPromotion | null) => void;
};

export function handlePromotionPick(args: HandlePromotionPickArgs): void {
  const {
    pending,
    promotion,
    rulesFen,
    game,
    sounds,
    applySuccessfulMove,
    onMove,
    setPendingPromotion,
  } = args;
  setPendingPromotion(null);
  const res = applyPlyForBoardUi(rulesFen, game.tryMove, {
    from: pending.from,
    to: pending.to,
    promotion,
  });
  if (!res.ok) {
    sounds.playIllegal();
    hapticError();
    return;
  }
  hapticForMove(res.move, res.inCheck);
  applySuccessfulMove(res.move, {
    inCheck: res.inCheck,
    isGameOver: res.isGameOver,
  });
  onMove?.(res.move);
}
