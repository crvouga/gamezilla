import type { PuzzleActionBarSlot } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import type { HintStage } from '@libs/game-puzzle-shared-ts/hint-stage';
import type { SolveStatus } from '@libs/game-puzzle-shared-ts/solve-status';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  ChevronRightIcon,
  LightbulbIcon,
  RotateCcwIcon,
} from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from '@solidjs/web';
import { Match, Switch } from 'solid-js';

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
  onRetry: () => void;
  fullWidth?: boolean | undefined;
}): JSX.Element {
  // After a wrong move retrying is the thing to do; once the puzzle is
  // over it is the quieter second choice beside Next.
  const prominent = (): boolean => props.slot.type === 'button';
  return (
    <Button
      title={<Trans>Retry</Trans>}
      intent={prominent() ? 'primary' : 'neutral'}
      variant={prominent() ? 'solid' : 'outline'}
      icon={RotateCcwIcon}
      fullWidth={props.fullWidth}
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
  /** The one thing to do now, on a row of its own. */
  fullWidth?: boolean | undefined;
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
            fullWidth={props.fullWidth}
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
            onRetry={props.model.onRetry}
            fullWidth={props.fullWidth}
          />
        )}
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
  fullWidth?: boolean | undefined;
  size?: 'sm' | undefined;
  /** Share a row equally with its neighbours. */
  flex?: number | undefined;
}): JSX.Element {
  return (
    <Button
      title={<Trans>Skip puzzle</Trans>}
      intent="neutral"
      // A quiet bordered button: its edge lines up with the column's.
      variant="outline"
      size={props.size}
      flex={props.flex}
      fullWidth={props.fullWidth}
      disabled={props.disabled}
      onClick={() => props.onSkip()}
      dataSet={{ testid: 'chess-puzzle-action-skip' }}
    />
  );
}
