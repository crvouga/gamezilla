import type { PuzzleActionBarSlot } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import type { HintStage } from '@libs/game-puzzle-shared-ts/hint-stage';
import type { SolveStatus } from '@libs/game-puzzle-shared-ts/solve-status';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  ChevronRightIcon,
  LightbulbIcon,
  RotateCcwIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { type JSX, Match, Switch } from 'solid-js';

export type PuzzleActionBarModel = {
  status: SolveStatus;
  hintStage: HintStage;
  /** Looking back at an earlier move: the hint waits for the latest. */
  canGoForward: boolean;
  onHint: () => void;
  onSolution: () => void;
  onRetry: () => void;
  onSkip: () => void;
  onNext: () => void;
};

type Slot<Id extends PuzzleActionBarSlot['id']> = Extract<
  PuzzleActionBarSlot,
  { id: Id }
>;

/** One escalating help button: Hint, then Solution. */
function HintButton(props: {
  slot: Slot<'hint'>;
  hintStage: HintStage;
  onHint: () => void;
}): JSX.Element {
  return (
    <Button
      title={
        <Switch fallback={<Trans>Reveal move</Trans>}>
          <Match when={props.slot.hintLabel === 'hint'}>
            <Trans>Hint</Trans>
          </Match>
          <Match when={props.hintStage === 'solution'}>
            <Trans>Reveal and end attempt</Trans>
          </Match>
        </Switch>
      }
      intent="neutral"
      variant="outline"
      icon={LightbulbIcon}
      disabled={props.slot.disabled}
      onClick={() => props.onHint()}
      dataSet={{ testid: 'chess-puzzle-action-hint' }}
    />
  );
}

function RetryButton(props: {
  slot: Slot<'retry'>;
  lead: boolean;
  onRetry: () => void;
}): JSX.Element {
  // After a wrong move retrying is the thing to do, so it leads, filled;
  // once the puzzle is over it is the quieter second choice beside Next.
  return (
    <Button
      title={<Trans>Retry</Trans>}
      intent={props.lead ? 'primary' : 'neutral'}
      variant={props.lead ? 'solid' : 'outline'}
      size={props.lead ? 'lg' : 'md'}
      fullWidth={props.lead}
      icon={RotateCcwIcon}
      disabled={props.slot.type === 'action' && props.slot.disabled}
      onClick={() => props.onRetry()}
      dataSet={{ testid: 'chess-puzzle-action-retry' }}
    />
  );
}

/**
 * One slot of the plan as its button; Skip is drawn after them. `lead`:
 * the one command the state leads with, filled and the bar's full width.
 */
export function PuzzleActionButton(props: {
  slot: Exclude<PuzzleActionBarSlot, { id: 'skip' }>;
  model: PuzzleActionBarModel;
  lead?: boolean | undefined;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.slot.id === 'hint' && props.slot} keyed>
        {(slot) => (
          <HintButton
            slot={slot}
            hintStage={props.model.hintStage}
            onHint={props.model.onHint}
          />
        )}
      </Match>
      <Match when={props.slot.id === 'solution' && props.slot} keyed>
        {(slot) => (
          <Button
            title={<Trans>Reveal and end attempt</Trans>}
            intent="neutral"
            variant="outline"
            icon={LightbulbIcon}
            disabled={slot.type === 'action' && slot.disabled}
            onClick={() => props.model.onSolution()}
            dataSet={{ testid: 'chess-puzzle-action-solution' }}
          />
        )}
      </Match>
      <Match when={props.slot.id === 'retry' && props.slot} keyed>
        {(slot) => (
          <RetryButton
            slot={slot}
            lead={props.lead === true}
            onRetry={props.model.onRetry}
          />
        )}
      </Match>
      <Match when={props.slot.id === 'next'}>
        <Button
          title={<Trans>Next puzzle</Trans>}
          intent="primary"
          size={props.lead === true ? 'lg' : 'md'}
          fullWidth={props.lead === true}
          endIcon={<ChevronRightIcon />}
          onClick={() => props.model.onNext()}
          dataSet={{ testid: 'chess-puzzle-action-next' }}
        />
      </Match>
    </Switch>
  );
}

/** Leaving this puzzle for the next: a quieter command than help beside it. */
export function PuzzleSkipButton(props: {
  disabled: boolean;
  onSkip: () => void;
}): JSX.Element {
  return (
    <Button
      title={<Trans>Skip puzzle</Trans>}
      intent="neutral"
      variant="ghost"
      disabled={props.disabled}
      onClick={() => props.onSkip()}
      dataSet={{ testid: 'chess-puzzle-action-skip' }}
    />
  );
}
