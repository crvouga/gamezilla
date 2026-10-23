import type { PuzzleCompletion } from '@libs/game-puzzle-shared-ts/completion';
import { type Accessor, createEffect, createMemo, on } from 'solid-js';

/** Instant display and one feedback cue per distinct completion, including a late rating. */
export function usePuzzleRatingFeedback(args: {
  readonly completion: Accessor<PuzzleCompletion>;
  readonly feedbackEnabled: Accessor<boolean>;
  readonly onDisplayRatingChange: (rating: number) => void;
  readonly onRatingComplete: (delta: number) => void;
}): { readonly displayRating: Accessor<number> } {
  const displayRating = createMemo(() => args.completion().ratingAfter);
  const completionKey = createMemo(() => {
    const completion = args.completion();
    return `${completion.outcome}-${completion.ratingBefore}-${completion.ratingAfter}-${completion.rated}`;
  });
  createEffect(
    on(completionKey, () => {
      const completion = args.completion();
      args.onDisplayRatingChange(completion.ratingAfter);
      if (args.feedbackEnabled()) args.onRatingComplete(completion.delta);
    })
  );
  return { displayRating };
}
