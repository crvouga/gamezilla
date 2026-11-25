import type { PuzzleActionBarSlot } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import { buildPuzzleActionBarPlan } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createMemo, For, type JSX, Show } from 'solid-js';
import {
  type PuzzleActionBarModel,
  PuzzleActionButton,
  PuzzleSkipButton,
} from './puzzle-action-bar-items';

export type PuzzleActionBarProps = PuzzleActionBarModel & {
  /** At the far end of the skip row: stepping through the moves so far. */
  trailing?: JSX.Element | undefined;
};

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
  // After a wrong move Retry is the one thing to do: it leads, and
  // revealing and skipping follow under it, each the column's full width,
  // in the same order on a phone and beside a wide board.
  const lead = (): ActionSlot | undefined =>
    actions().find((slot) => slot.id === 'retry' && slot.type === 'button');
  return (
    <Show
      when={lead() !== undefined}
      fallback={
        // Help is the one command while solving: the column's full width.
        // Skipping, a different kind of choice, is quiet text under it,
        // with stepping through the moves at the row's far end.
        <StackVertical gap="xs">
          <For each={actions()}>
            {(slot) => (
              <PuzzleActionButton slot={slot} model={props} fullWidth />
            )}
          </For>
          <StackHorizontal gap="sm" align="center" justify="between">
            <Show when={skip()} fallback={<StackHorizontal />}>
              {(slot) => (
                <PuzzleSkipButton
                  disabled={slot().disabled}
                  onSkip={props.onSkip}
                  size="sm"
                />
              )}
            </Show>
            {props.trailing}
          </StackHorizontal>
        </StackVertical>
      }
    >
      <StackVertical gap="sm">
        <Show when={lead()} keyed>
          {(slot) => <PuzzleActionButton slot={slot} model={props} fullWidth />}
        </Show>
        <For each={actions().filter((slot) => slot !== lead())}>
          {(slot) => <PuzzleActionButton slot={slot} model={props} fullWidth />}
        </For>
        <Show when={skip()}>
          {(slot) => (
            <PuzzleSkipButton
              disabled={slot().disabled}
              onSkip={props.onSkip}
              fullWidth
            />
          )}
        </Show>
      </StackVertical>
    </Show>
  );
}
