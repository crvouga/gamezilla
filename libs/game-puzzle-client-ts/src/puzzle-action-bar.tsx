import type { PuzzleActionBarSlot } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import { buildPuzzleActionBarPlan } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createMemo, For, type JSX, Show } from 'solid-js';
import {
  type PuzzleActionBarModel,
  PuzzleActionButton,
  PuzzleSkipButton,
} from './puzzle-action-bar-items';

export type PuzzleActionBarProps = PuzzleActionBarModel;

type ActionSlot = Exclude<PuzzleActionBarSlot, { id: 'skip' }>;

/**
 * What is done about the puzzle, in one group: help, retrying or moving on,
 * then skipping the puzzle — a different kind of choice — as a quiet text
 * button right beside them, never stranded at the row's far end. Moving
 * through the line is the move list's own row.
 */
export function PuzzleActionBar(props: PuzzleActionBarProps): JSX.Element {
  const slots = createMemo(() =>
    buildPuzzleActionBarPlan({
      status: props.status,
      hintStage: props.hintStage,
      canGoForward: props.canGoForward,
    })
  );
  const actions = (): ActionSlot[] =>
    slots().filter((slot): slot is ActionSlot => slot.id !== 'skip');
  const skip = (): Extract<PuzzleActionBarSlot, { id: 'skip' }> | undefined =>
    slots().find(
      (slot): slot is Extract<PuzzleActionBarSlot, { id: 'skip' }> =>
        slot.id === 'skip'
    );
  // After a wrong move Retry is the one thing to do: it leads, on a row of
  // its own, and revealing or skipping follow as the quieter pair.
  const lead = (): ActionSlot | undefined =>
    actions().find((slot) => slot.id === 'retry' && slot.type === 'button');
  const rest = (): ActionSlot[] => actions().filter((slot) => slot !== lead());
  return (
    <StackVertical gap="sm">
      <Show when={lead()} keyed>
        {(slot) => <PuzzleActionButton slot={slot} model={props} fullWidth />}
      </Show>
      <StackHorizontal gap="sm" align="center" wrap>
        <For each={rest()}>
          {(slot) => <PuzzleActionButton slot={slot} model={props} />}
        </For>
        <Show when={skip()}>
          {(slot) => (
            <PuzzleSkipButton
              disabled={slot().disabled}
              onSkip={props.onSkip}
            />
          )}
        </Show>
      </StackHorizontal>
    </StackVertical>
  );
}
