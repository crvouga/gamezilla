import { formatPuzzleRating } from '@libs/game-puzzle-shared-ts/rating';
import { Trans } from '@lingui/solid/macro';
import { H3 } from '@pkgs/ui-root-client-ts/heading';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { ColorTone } from '@pkgs/ui-root-shared-ts/token-names';
import type { JSX } from 'solid-js';

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
  return (
    <>
      <H3
        size="heading"
        align="center"
        numeral
        testId="chess-puzzle-summary-rating"
      >
        {formatPuzzleRating({
          rating: props.displayRating,
          provisional: props.provisional,
        })}
      </H3>
      <P
        variant="bodyBold"
        align="center"
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
    </>
  );
}
