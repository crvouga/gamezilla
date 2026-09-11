import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { ChessPuzzleEloDelta } from './chess-puzzle-elo-delta';
import type { PuzzleCompletion } from './use-chess-puzzle-completion';

function StreakBadge(props: { streak: number }): JSX.Element {
  return (
    <div class="box px-3 py-1 rounded-[999px] bg-success-surface">
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
      <p class="text textCaption text-text-secondary">
        {<Trans>Puzzle rating {puzzleRating}</Trans>}
      </p>
    </div>
  );
}

export type ChessPuzzleSummaryCardProps = {
  completion: PuzzleCompletion;
  displayRating: number;
};

/** Body for the celebration modal (title lives on {@link ResponsiveSurface}). */
export function ChessPuzzleSummaryCard(
  props: ChessPuzzleSummaryCardProps
): JSX.Element {
  return (
    <div class="box gap-3 items-center self-stretch min-w-[0]">
      <ChessPuzzleEloDelta
        ratingBefore={props.completion.ratingBefore}
        ratingAfter={props.completion.ratingAfter}
        delta={props.completion.delta}
        displayRating={props.displayRating}
      />
      <SummaryMeta completion={props.completion} />
    </div>
  );
}
