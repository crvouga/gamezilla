import type { PuzzleCompletion } from '@libs/game-puzzle-shared-ts/completion';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { PuzzleRatingDelta } from './puzzle-rating-delta';

export type PuzzleSummaryCardProps = {
  completion: PuzzleCompletion;
  displayRating: number;
  provisional: boolean;
};

/**
 * The rating a finished puzzle made: the new rating, its change under it,
 * at the end of the result card's line (the streak is one of its facts).
 */
export function PuzzleSummaryCard(props: PuzzleSummaryCardProps): JSX.Element {
  return (
    <StackVertical gap="none" align="end">
      <PuzzleRatingDelta
        ratingBefore={props.completion.ratingBefore}
        ratingAfter={props.completion.ratingAfter}
        delta={props.completion.delta}
        displayRating={props.displayRating}
        rated={props.completion.rated}
        provisional={props.provisional}
      />
    </StackVertical>
  );
}
