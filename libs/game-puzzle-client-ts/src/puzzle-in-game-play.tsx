import {
  buildPuzzleActionBarPlan,
  type PuzzleActionBarSlot,
} from '@libs/game-puzzle-shared-ts/action-bar-plan';
import { formatPuzzleClock } from '@libs/game-puzzle-shared-ts/puzzle-clock';
import type { PuzzleStatusKind } from '@libs/game-puzzle-shared-ts/status-kind';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import type { SpaceGameAction } from '@pkgs/ui-root-client-ts/space-types';
import type { Accessor } from 'solid-js';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';

/** The status line's words for a status with no turn to prompt. */
function useStatusLabels(): (kind: PuzzleStatusKind) => string {
  const { t } = useLingui();
  return (kind) =>
    ({
      loading: t`Loading puzzle…`,
      empty: t`No puzzles left`,
      offline: t`Offline`,
      limited: t`Daily limit reached`,
      waiting: t`Waiting for the host`,
      started: t`Started`,
      failed: t`Failed`,
      skipped: t`Skipped`,
      solved: t`Solved`,
    })[kind] ?? '';
}

/**
 * The status line over the board: once the setup move has played, the
 * solver's side is to move (§5) in the board's own words, `Correct · …`
 * after a right move; a revealed attempt teaches the line; any other
 * status says how the attempt stands.
 */
export function usePuzzleStatusText(
  view: () => PuzzlePlayScreenViewProps
): Accessor<string> {
  const { t } = useLingui();
  const label = useStatusLabels();
  return () => {
    const props = view();
    if (props.status === 'revealed') return t`Solution shown`;
    const side = props.solverSide;
    if (props.statusKind === 'started' && side) {
      return props.correct === true
        ? t`Correct · ${side} to move`
        : t`${side} to move`;
    }
    return label(props.statusKind);
  };
}

/** The solve clock beside the status (`m:ss`); unset while it is hidden. */
export function puzzleClockDetail(
  elapsedMs: number | null
): string | undefined {
  return elapsedMs === null ? undefined : formatPuzzleClock(elapsedMs);
}

type Slot = PuzzleActionBarSlot;

/**
 * What is done about the puzzle, as the solve state allows it
 * (`buildPuzzleActionBarPlan`), as the action bar's actions: help (Hint,
 * then the solution), retrying or moving on, then skipping it.
 */
export function usePuzzleSolveActions(
  view: () => PuzzlePlayScreenViewProps
): Accessor<readonly SpaceGameAction[]> {
  const { t } = useLingui();
  const action = (slot: Slot, props: PuzzlePlayScreenViewProps) => {
    const disabled = slot.type === 'action' ? slot.disabled : false;
    switch (slot.id) {
      case 'hint':
        return {
          id: 'hint',
          label:
            slot.hintLabel === 'hint'
              ? t`Hint`
              : props.hintStage === 'solution'
                ? t`Reveal and end attempt`
                : t`Reveal move`,
          disabled,
          onPress: () => props.onHint(),
          testId: Handles.chessPuzzleActionHint,
        };
      case 'solution':
        return {
          id: 'solution',
          label: t`Reveal and end attempt`,
          disabled,
          onPress: () => props.onSolution(),
          testId: Handles.chessPuzzleActionSolution,
        };
      case 'retry':
        // After a wrong move retrying is the thing to do; once the puzzle
        // is over it is the quieter choice beside Next.
        return {
          id: 'retry',
          label: t`Retry`,
          emphasis: slot.type === 'button' ? ('primary' as const) : undefined,
          disabled,
          onPress: () => props.onRetry(),
          testId: Handles.chessPuzzleActionRetry,
        };
      case 'next':
        return {
          id: 'next',
          label: t`Next`,
          emphasis: 'primary' as const,
          onPress: () => props.onNext(),
          testId: Handles.chessPuzzleActionNext,
        };
      default:
        return {
          id: 'skip',
          label: t`Skip puzzle`,
          disabled,
          onPress: () => props.onSkip(),
          testId: Handles.chessPuzzleActionSkip,
        };
    }
  };
  return () => {
    const props = view();
    return buildPuzzleActionBarPlan({
      status: props.status,
      hintStage: props.hintStage,
      canGoForward: props.canGoForward,
    }).map((slot): SpaceGameAction => action(slot, props));
  };
}
