import { formatPuzzleRating } from '@libs/chess-puzzle-shared/chess-puzzle-rating';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';

const HIDDEN_RATING = '\u2007'.repeat(4);

export type ChessPuzzleRatingChipProps = {
  rating: number;
  /** §8: append the "?" marker while the rating is still provisional. */
  provisional?: boolean;
  variant?: 'primary' | 'muted';
  testID?: string;
  /** Hide the chip without dropping its box, so a later rating cannot reflow the row. */
  invisible?: boolean;
};

export function ChessPuzzleRatingChip(
  props: ChessPuzzleRatingChipProps
): JSX.Element {
  const isPrimary = () =>
    props.variant === undefined || props.variant === 'primary';
  // A hidden chip keeps its width with figure spaces, so it says nothing
  // to anyone, on screen or listening.
  const label = () =>
    props.invisible === true
      ? HIDDEN_RATING
      : formatPuzzleRating({
          rating: props.rating,
          provisional: props.provisional === true,
        });

  return (
    <div
      class="box px-2.5 py-1 rounded-full shrink-0"
      classList={{
        invisible: props.invisible === true,
        'bg-tint-subtle': isPrimary(),
        'bg-surface-muted': !isPrimary(),
      }}
      aria-hidden={props.invisible === true ? true : undefined}
      {...dataAttrs(
        props.testID !== undefined ? { testid: props.testID } : undefined
      )}
    >
      <p
        class="text textBody textNumeral min-w-8 text-center whitespace-nowrap"
        classList={{
          'textNumeral text-tint': isPrimary(),
          textFootnote: !isPrimary(),
        }}
      >
        {label()}
      </p>
    </div>
  );
}
