import type { PuzzleCompletion } from '@libs/game-puzzle-shared/completion';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client/badge';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
import { P } from '@pkgs/ui-root-client/text';
import { type JSX, Show } from 'solid-js';
import { PuzzleRatingDelta } from './puzzle-rating-delta';

function SummaryMeta(props: { completion: PuzzleCompletion }): JSX.Element {
  return (
    <StackVertical gap="sm" align="center">
      <Show when={props.completion.streak > 1}>
        <StackHorizontal>
          <Badge
            intent="success"
            label={<Trans>{props.completion.streak} puzzle streak</Trans>}
          />
        </StackHorizontal>
      </Show>
      <P
        variant="caption"
        tone="secondary"
        testId="chess-puzzle-summary-puzzle-rating"
      >
        {<Trans>Puzzle rating {props.completion.puzzleRating}</Trans>}
      </P>
    </StackVertical>
  );
}

export type PuzzleSummaryCardProps = {
  completion: PuzzleCompletion;
  displayRating: number;
  provisional: boolean;
};

/** Body for the celebration modal (title lives on {@link ResponsiveSurface}). */
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
