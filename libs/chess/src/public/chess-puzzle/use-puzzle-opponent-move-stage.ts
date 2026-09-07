import { useTimers } from '@pkgs/clock/solid';
import { createSubscriptionSignal } from '@pkgs/solid-context/subscription-signal';
import { type Accessor, createEffect, onCleanup } from 'solid-js';

import {
  createPuzzleOpponentStager,
  type OpponentStagerInput,
  type OpponentStagerSnapshot,
} from '../../shared/puzzle-session/opponent-stager';

export type PuzzleOpponentMoveStage = OpponentStagerSnapshot;

export function usePuzzleOpponentMoveStage(
  args: Accessor<OpponentStagerInput>
): Accessor<PuzzleOpponentMoveStage> {
  const timers = useTimers();
  const stager = createPuzzleOpponentStager(timers);
  onCleanup(() => stager.dispose());

  createEffect(() => {
    stager.update(args());
  });

  return createSubscriptionSignal(stager);
}
