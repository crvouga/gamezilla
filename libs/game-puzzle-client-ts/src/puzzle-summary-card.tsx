import type { PuzzleCompletion } from '@libs/game-puzzle-shared-ts/completion';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import { PuzzleRatingDelta } from './puzzle-rating-delta';

function SummaryMeta(props: { completion: PuzzleCompletion }): JSX.Element {
  return (
    <Show when={props.completion.streak > 1}>
      <StackHorizontal>
        <Badge
          intent="success"
          label={<Trans>{props.completion.streak} puzzle streak</Trans>}
        />
      </StackHorizontal>
    </Show>
  );
}

export type PuzzleSummaryCardProps = {
  completion: PuzzleCompletion;
  displayRating: number;
  provisional: boolean;
};

/** The rating a finished puzzle made, and the streak it kept. */
export function PuzzleSummaryCard(props: PuzzleSummaryCardProps): JSX.Element {
  return (
    <StackVertical gap="md" align="center" self="stretch">
      <PuzzleRatingDelta
        ratingBefore={props.completion.ratingBefore}
        ratingAfter={props.completion.ratingAfter}
        delta={props.completion.delta}
        displayRating={props.displayRating}
        rated={props.completion.rated}
        provisional={props.provisional}
      />
      <SummaryMeta completion={props.completion} />
    </StackVertical>
  );
}
