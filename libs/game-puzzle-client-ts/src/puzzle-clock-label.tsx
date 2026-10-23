import { formatPuzzleClock } from '@libs/game-puzzle-shared-ts/puzzle-clock';
import { ClockIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { Accessor, JSX } from 'solid-js';
import { Show } from 'solid-js';

/** Elapsed solve time for the live attempt (`m:ss`), frozen once terminal. */
export function PuzzleClockLabel(props: {
  elapsedMs: Accessor<number | null>;
}): JSX.Element {
  return (
    <Show when={props.elapsedMs() !== null}>
      <StackHorizontal align="center" gap="xs" testId="chess-puzzle-clock">
        <ClockIcon size={14} color="textSecondary" />
        <P numeral>{formatPuzzleClock(props.elapsedMs() ?? 0)}</P>
      </StackHorizontal>
    </Show>
  );
}
