import type { CustomGameReview } from './use-custom-game-review';
import type { CustomGameScreenModel } from './use-custom-game-screen';

/** Whether this person may move on the live board right now. */
export function customGameCanMove(
  model: CustomGameScreenModel,
  review: CustomGameReview
): boolean {
  return (
    review.live() &&
    model.current()?.status === 'active' &&
    model.mySide() === model.current()?.turn &&
    model.canPlay() &&
    !model.submitting() &&
    model.canSubmit()
  );
}
