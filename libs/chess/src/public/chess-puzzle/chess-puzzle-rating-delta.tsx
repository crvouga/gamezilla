import { Trans } from '@lingui/solid/macro';
import { useTheme } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { formatPuzzleRating } from '../chess-puzzle-rating';

function formatSignedDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export type ChessPuzzleRatingDeltaProps = {
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  displayRating: number;
  /** False for a repeat attempt / exhausted-pool re-serve (§8, §9). */
  rated: boolean;
  /** §8 provisional marker on the headline rating. */
  provisional: boolean;
};

export function ChessPuzzleRatingDelta(
  props: ChessPuzzleRatingDeltaProps
): JSX.Element {
  const theme = useTheme();

  const deltaColor = (): string =>
    props.delta > 0
      ? theme.colors.success
      : props.delta < 0
        ? theme.colors.destructive
        : theme.colors.textSecondary;

  return (
    <>
      <h3
        class="text textHeading text-text text-center"
        data-testid="chess-puzzle-summary-rating"
      >
        {formatPuzzleRating({
          rating: props.displayRating,
          provisional: props.provisional,
        })}
      </h3>
      <p
        class="text textBodyBold text-center"
        style={{
          color: props.rated ? deltaColor() : theme.colors.textSecondary,
        }}
        data-testid="chess-puzzle-summary-delta"
      >
        {props.rated ? (
          formatSignedDelta(props.delta)
        ) : (
          <Trans>Unrated · already played</Trans>
        )}
      </p>
    </>
  );
}
