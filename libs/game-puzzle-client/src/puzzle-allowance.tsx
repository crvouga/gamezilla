import { Show } from 'solid-js';
import { usePuzzleAllowance } from './use-puzzle-allowance';

export function PuzzleAllowance() {
  const allowance = usePuzzleAllowance();
  return (
    <Show when={allowance.remaining() !== null}>
      <p
        class="text textCaption text-text-secondary px-3 py-1"
        data-testid="chess-puzzle-remaining-today"
      >
        {allowance.label()}
      </p>
    </Show>
  );
}
