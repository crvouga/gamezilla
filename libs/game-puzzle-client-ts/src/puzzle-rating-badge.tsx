import { formatPuzzleRating } from '@libs/game-puzzle-shared-ts/rating';
import { Badge, type BadgeIntent } from '@pkgs/ui-root-client-ts/badge';
import type { JSX } from 'solid-js';

const HIDDEN_RATING = ' '.repeat(4);

export type PuzzleRatingBadgeProps = {
  rating: number;
  /** §8: append the "?" marker while the rating is still provisional. */
  provisional?: boolean;
  /** Default `neutral`: a quiet fact among the feed's other tags. */
  intent?: BadgeIntent;
  testId?: string;
  /** Hide the badge without dropping its box, so a later rating cannot reflow the row. */
  invisible?: boolean;
  /** Names the number before it ("Puzzle rating 1702"). */
  prefix?: string | undefined;
};

/** A puzzle rating as a badge, provisional marker included. */
export function PuzzleRatingBadge(props: PuzzleRatingBadgeProps): JSX.Element {
  // A hidden badge keeps its width with figure spaces, so it says nothing
  // to anyone, on screen or listening.
  const value = (): string =>
    props.invisible === true
      ? HIDDEN_RATING
      : formatPuzzleRating({
          rating: props.rating,
          provisional: props.provisional === true,
        });
  // A hidden badge says nothing, its prefix included: words a sighted
  // reader cannot see would otherwise count as the button's visible label.
  const label = (): string =>
    props.prefix === undefined || props.invisible === true
      ? value()
      : `${props.prefix} ${value()}`;
  return (
    <Badge
      label={label()}
      intent={props.intent ?? 'neutral'}
      invisible={props.invisible === true}
      dataSet={
        props.testId === undefined ? undefined : { testid: props.testId }
      }
    />
  );
}
