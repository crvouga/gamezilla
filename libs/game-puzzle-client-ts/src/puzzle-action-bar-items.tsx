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
  onHint: () => void;
}): JSX.Element {
  return (
    <Button
      title={
        props.slot.hintLabel === 'solution' ? (
          <Trans>Solution</Trans>
        ) : (
          <Trans>Hint</Trans>
        )
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
  onRetry: () => void;
}): JSX.Element {
  // After a wrong move retrying is the thing to do; once the puzzle is
  // over it is the quieter second choice beside Next.
  const prominent = (): boolean => props.slot.type === 'button';
  return (
    <Button
      title={<Trans>Retry</Trans>}
      intent={prominent() ? 'danger' : 'neutral'}
      variant={prominent() ? 'solid' : 'outline'}
      icon={RotateCcwIcon}
      disabled={props.slot.type === 'action' && props.slot.disabled}
      onClick={() => props.onRetry()}
      dataSet={{ testid: 'chess-puzzle-action-retry' }}
    />
  );
}

/** One slot of the plan as its button; Skip is drawn after them. */
export function PuzzleActionButton(props: {
  slot: Exclude<PuzzleActionBarSlot, { id: 'skip' }>;
  model: PuzzleActionBarModel;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.slot.id === 'hint' && props.slot} keyed>
        {(slot) => <HintButton slot={slot} onHint={props.model.onHint} />}
      </Match>
      <Match when={props.slot.id === 'solution' && props.slot} keyed>
        {(slot) => (
          <Button
            title={<Trans>Solution</Trans>}
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
        {(slot) => <RetryButton slot={slot} onRetry={props.model.onRetry} />}
      </Match>
      <Match when={props.slot.id === 'next'}>
        <Button
          title={<Trans>Next</Trans>}
          intent="primary"
          endIcon={<ChevronRightIcon />}
          onClick={() => props.model.onNext()}
          dataSet={{ testid: 'chess-puzzle-action-next' }}
        />
      </Match>
    </Switch>
  );
}

/** Leaving this puzzle for the next: a quiet text button after help. */
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
