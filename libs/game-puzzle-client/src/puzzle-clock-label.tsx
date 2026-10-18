import { formatPuzzleClock } from '@libs/game-puzzle-shared/puzzle-clock';
import { ClockIcon } from '@pkgs/ui-root-client/icons';
import type { Accessor, JSX } from 'solid-js';
import { Show } from 'solid-js';

/** Elapsed solve time for the live attempt (`m:ss`), frozen once terminal. */
export function PuzzleClockLabel(props: {
  elapsedMs: Accessor<number | null>;
}): JSX.Element {
  return (
    <Show when={props.elapsedMs() !== null}>
      <p
        class="box flex-row items-center gap-1 shrink-0"
        data-testid="chess-puzzle-clock"
      >
        <ClockIcon size={14} color="textSecondary" />
        <span class="text textNumeral">
          {formatPuzzleClock(props.elapsedMs() ?? 0)}
        </span>
      </p>
    </Show>
  );
}
