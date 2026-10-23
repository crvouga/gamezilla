import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { Show } from 'solid-js';
import { usePuzzleAllowance } from './use-puzzle-allowance';

export function PuzzleAllowance() {
  const allowance = usePuzzleAllowance();
  return (
    <Show when={allowance.remaining() !== null}>
      <StackVertical paddingX="md" paddingY="xs">
        <P
          variant="caption"
          tone="secondary"
          testId="chess-puzzle-remaining-today"
        >
          {allowance.label()}
        </P>
      </StackVertical>
    </Show>
  );
}
