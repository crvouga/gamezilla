import { formatPuzzleRating } from '@libs/game-puzzle-shared-ts/rating';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { H3 } from '@pkgs/ui-root-client-ts/heading';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { ColorTone } from '@pkgs/ui-root-shared-ts/token-names';
import type { JSX } from '@solidjs/web';

function formatSignedDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export type PuzzleRatingDeltaProps = {
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  displayRating: number;
  /** False for a repeat attempt / exhausted-pool re-serve (§8, §9). */
  rated: boolean;
  /** §8 provisional marker on the headline rating. */
  provisional: boolean;
};

/** Up is success, down destructive, flat or unrated a quiet secondary. */
function deltaTone(props: PuzzleRatingDeltaProps): ColorTone {
  if (!props.rated || props.delta === 0) return 'secondary';
  return props.delta > 0 ? 'success' : 'destructive';
}

export function PuzzleRatingDelta(props: PuzzleRatingDeltaProps): JSX.Element {
  // One line: what the number is, the rating, and what this puzzle did to
  // it, so it fits the fixed row over the board.
  return (
    <StackHorizontal align="baseline" gap="sm">
      <P variant="caption" tone="secondary">
        <Trans>Your rating</Trans>
      </P>
      <H3 size="label" numeral testId="chess-puzzle-summary-rating">
        {formatPuzzleRating({
          rating: props.displayRating,
          provisional: props.provisional,
        })}
      </H3>
      <P
        variant="bodyBold"
        numeral
        tone={deltaTone(props)}
        testId="chess-puzzle-summary-delta"
      >
        {props.rated ? (
          formatSignedDelta(props.delta)
        ) : (
          <Trans>Unrated · already played</Trans>
        )}
      </P>
    </StackHorizontal>
  );
}
