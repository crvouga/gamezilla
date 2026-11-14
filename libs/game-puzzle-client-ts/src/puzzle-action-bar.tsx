import type { PuzzleActionBarSlot } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import { buildPuzzleActionBarPlan } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createMemo, For, type JSX, Match, Show, Switch } from 'solid-js';
import {
  type PuzzleActionBarModel,
  PuzzleActionButton,
  PuzzleSkipButton,
} from './puzzle-action-bar-items';

export type PuzzleActionBarProps = PuzzleActionBarModel & {
  /** After the rest, on their line (a compact way to the settings). */
  readonly extra?: JSX.Element;
};

/**
 * The one command the state leads with (Next once it is over, Retry after a
 * wrong move); while solving there is none, help and Skip share the row.
 */
function isLead(slot: PuzzleActionBarSlot): boolean {
  return slot.type === 'button';
}

/**
 * What is done about the puzzle, as one docked group: the command the
 * state leads with on a line of its own and filled, then the rest (help,
 * retrying a finished puzzle, skipping it) on one even line, each label
 * whole, wrapping only when a line cannot hold them.
 */
export function PuzzleActionBar(props: PuzzleActionBarProps): JSX.Element {
  const slots = createMemo(() =>
    buildPuzzleActionBarPlan({
      status: props.status,
      hintStage: props.hintStage,
      canGoForward: props.canGoForward,
    })
  );
  const lead = (): PuzzleActionBarSlot | undefined => slots().find(isLead);
  const rest = (): PuzzleActionBarSlot[] =>
    slots().filter((slot) => !isLead(slot));
  return (
    <StackVertical gap="sm" testId="chess-puzzle-action-bar">
      <Show when={lead()} keyed>
        {(slot) => <SlotButton slot={slot} model={props} lead />}
      </Show>
      <GameActions sizing="fill">
        <For each={rest()}>
          {(slot) => <SlotButton slot={slot} model={props} />}
        </For>
        {props.extra}
      </GameActions>
    </StackVertical>
  );
}

type ActionSlot = Exclude<PuzzleActionBarSlot, { id: 'skip' }>;

function actionSlot(slot: PuzzleActionBarSlot): ActionSlot | false {
  return slot.id === 'skip' ? false : slot;
}

function SlotButton(props: {
  slot: PuzzleActionBarSlot;
  model: PuzzleActionBarModel;
  lead?: boolean;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.slot.id === 'skip' && props.slot} keyed>
        {(slot) => (
          <PuzzleSkipButton
            disabled={slot.disabled}
            onSkip={props.model.onSkip}
          />
        )}
      </Match>
      <Match when={actionSlot(props.slot)} keyed>
        {(slot) => (
          <PuzzleActionButton
            slot={slot}
            model={props.model}
            lead={props.lead === true}
          />
        )}
      </Match>
    </Switch>
  );
}
