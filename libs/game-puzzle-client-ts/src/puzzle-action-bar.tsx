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
  /** Beside Skip, an equal button: looking back through the line. */
  beside?: JSX.Element | undefined;
};

type ActionSlot = Exclude<PuzzleActionBarSlot, { id: 'skip' }>;

/** Skipping, quiet text at the column's start in every solving state. */
function SkipRow(props: {
  slot: Extract<PuzzleActionBarSlot, { id: 'skip' }> | undefined;
  onSkip: () => void;
  beside?: JSX.Element | undefined;
}): JSX.Element {
  // Skipping and looking back: two equal quiet buttons on one row.
  return (
    <StackHorizontal align="center" gap="sm">
      <Show when={props.slot}>
        {(slot) => (
          <PuzzleSkipButton
            disabled={slot().disabled}
            onSkip={props.onSkip}
            size="sm"
            fullWidth
          />
        )}
      </Show>
      {props.beside}
    </StackHorizontal>
  );
}

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
          <SkipRow slot={skip()} onSkip={props.onSkip} beside={props.beside} />
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
        <SkipRow slot={skip()} onSkip={props.onSkip} beside={props.beside} />
      </StackVertical>
    </Show>
  );
}
