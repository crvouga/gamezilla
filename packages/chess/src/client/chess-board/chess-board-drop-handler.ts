import { indexFromSquare } from './chess-board-geometry';
import {
  hapticError,
  hapticSelection,
  hapticSuccess,
} from './chess-board-haptics';
import type { ChessBoardSounds } from './chess-board-sounds';
import type { Move, PieceColor, Position, Square } from './chess-board-types';
import type { useChessBoardApplyMoveSound } from './use-chess-board-apply-move-sound';
import type { useChessGame, TryMoveResult } from './use-chess-game';
import { moveRequiresPromotionOnFen, tryMoveOnFen } from './use-chess-game';
import type { PendingPromotion } from './use-chess-board-interaction-state';

type GameLike = ReturnType<typeof useChessGame>;
type ApplyMoveSoundLike = ReturnType<typeof useChessBoardApplyMoveSound>;

/**
 * Controlled boards validate on a copy (`tryMoveOnFen`) but must still apply
 * the ply to the live `useChessGame` instance so `lastMove` + `position` feed
 * `useChessPieceRows` / piece slide animations; parent `fen` then replaces via
 * `useExternalFenSync` (e.g. engine reply).
 */
export function applyPlyForBoardUi(
  rulesFen: string | undefined,
  tryMove: GameLike['tryMove'],
  m: { from: Square; to: Square; promotion?: Move['promotion'] }
): TryMoveResult {
  if (rulesFen !== undefined) {
    const dry = tryMoveOnFen(rulesFen, m);
    if (!dry.ok) return dry;
    return tryMove(m);
  }
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

/** Routes a piece drop: promotion → open picker; otherwise apply + audio + haptic. */
export function handleDropAttempt(args: DropAttemptArgs): void {
  const {
    fromSq,
    toSq,
    rulesFen,
    position,
    turn,
    game,
    sounds,
    applySuccessfulMove,
    onMove,
    setPendingPromotion,
  } = args;
  const needsPromotion = rulesFen
    ? moveRequiresPromotionOnFen(rulesFen, fromSq, toSq)
    : game.moveRequiresPromotion(fromSq, toSq);
  if (needsPromotion) {
    const moverColor = position[indexFromSquare(fromSq)]?.color ?? turn;
    setPendingPromotion({ from: fromSq, to: toSq, color: moverColor });
    return;
  }
  const res = applyPlyForBoardUi(rulesFen, game.tryMove, {
    from: fromSq,
    to: toSq,
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
