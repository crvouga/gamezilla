import type { GameSessionReview } from './use-game-session-review';
import type { GameSessionScreenModel } from './use-game-session-screen';

/** Whether this person may move on the live board right now. */
/**
 * Whether this person may decide on the live board right now: move on their
 * turn, or make their private commitment while every side commits. A side a
 * stand-in plays is the stand-in's until they take it back.
 */
export function gameSessionCanMove(
  model: GameSessionScreenModel,
  review: GameSessionReview
): boolean {
  const game = model.current();
  const side = model.mySide();
  return (
    review.live() &&
    game?.status === 'active' &&
    side !== null &&
    !game.standIns.includes(side) &&
    (game.awaiting.length > 0
      ? game.awaiting.includes(side)
      : side === game.turn) &&
    model.canPlay() &&
    !model.submitting() &&
    (model.canSubmit() || model.movesWait())
  );
}
