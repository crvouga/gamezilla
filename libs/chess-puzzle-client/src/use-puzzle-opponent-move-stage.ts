import type {
  OpponentStagerInput,
  OpponentStagerSnapshot,
} from '@libs/chess-puzzle-shared/opponent-stager';
import { createPuzzleOpponentStager } from '@libs/chess-puzzle-shared/opponent-stager';
import { useTimers } from '@pkgs/clock-client/solid';
import { createSubscriptionSignal } from '@pkgs/solid-context-client/subscription-signal';
import { type Accessor, createEffect, onCleanup } from 'solid-js';

export type PuzzleOpponentMoveStage = OpponentStagerSnapshot;

export function usePuzzleOpponentMoveStage(
  args: Accessor<OpponentStagerInput>
): Accessor<PuzzleOpponentMoveStage> {
  const timers = useTimers();
  const stager = createPuzzleOpponentStager(timers, args());
  onCleanup(() => stager.dispose());

  createEffect(() => {
    stager.update(args());
  });

  return createSubscriptionSignal(stager);
}
