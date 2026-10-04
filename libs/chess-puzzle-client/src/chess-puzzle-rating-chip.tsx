import { dataAttrs } from '@pkgs/ui-shared/component-id';
import type { JSX } from 'solid-js';

import { formatPuzzleRating } from '@libs/chess-puzzle-shared/chess-puzzle-rating';

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
  const label = () =>
    formatPuzzleRating({
      rating: props.rating,
      provisional: props.provisional === true,
    });

  return (
    <div
      class="box px-2 py-1 rounded-sm shrink-0"
      classList={{ invisible: props.invisible === true }}
      style={{ background: isPrimary() ? 'tintMuted' : 'surfaceMuted' }}
      {...dataAttrs(
        props.testID !== undefined ? { testid: props.testID } : undefined
      )}
    >
      <p
        class="text min-w-8 tabular-nums text-center whitespace-nowrap"
        classList={{
          textBodyBold: isPrimary(),
          textCaption: !isPrimary(),
        }}
        style={{ color: isPrimary() ? 'tint' : 'textSecondary' }}
      >
        {label()}
      </p>
    </div>
  );
}
