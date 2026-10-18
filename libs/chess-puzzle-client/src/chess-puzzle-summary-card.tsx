import type { PuzzleCompletion } from '@libs/game-puzzle-shared/completion';
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { ChessPuzzleRatingDelta } from './chess-puzzle-rating-delta';

function StreakBadge(props: { streak: number }): JSX.Element {
  return (
    <div class="box px-3 py-1 rounded-full bg-success-surface">
      <p class="text textBodyBold text-success">
        {<Trans>{props.streak} puzzle streak</Trans>}
      </p>
    </div>
  );
}

function SummaryMeta(props: { completion: PuzzleCompletion }): JSX.Element {
  const streak = props.completion.streak;
  const puzzleRating = props.completion.puzzleRating;
  return (
    <div class="box gap-2 items-center">
      {streak > 1 ? <StreakBadge streak={streak} /> : null}
      <p
        class="text textCaption text-text-secondary"
        data-testid="chess-puzzle-summary-puzzle-rating"
      >
        {<Trans>Puzzle rating {puzzleRating}</Trans>}
      </p>
    </div>
  );
}

export type ChessPuzzleSummaryCardProps = {
  completion: PuzzleCompletion;
  displayRating: number;
  provisional: boolean;
};

/** Body for the celebration modal (title lives on {@link ResponsiveSurface}). */
export function ChessPuzzleSummaryCard(
  props: ChessPuzzleSummaryCardProps
): JSX.Element {
  return (
    <div class="box gap-3 items-center self-stretch min-w-0">
      <ChessPuzzleRatingDelta
        ratingBefore={props.completion.ratingBefore}
        ratingAfter={props.completion.ratingAfter}
        delta={props.completion.delta}
        displayRating={props.displayRating}
        rated={props.completion.rated}
        provisional={props.provisional}
      />
      <SummaryMeta completion={props.completion} />
    </div>
  );
}
