import type {
  OpponentStagerInput,
  OpponentStagerSnapshot,
} from '@libs/game-puzzle-shared-ts/opponent-stager';
import { createPuzzleOpponentStager } from '@libs/game-puzzle-shared-ts/opponent-stager';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { createSubscriptionSignal } from '@pkgs/solid-context-client-ts/subscription-signal';
import { type Accessor, createEffect, onCleanup, untrack } from 'solid-js';
import { usePuzzleGame } from './puzzle-game-context';

export type PuzzleOpponentMoveStage = OpponentStagerSnapshot;

export function usePuzzleOpponentMoveStage(
  args: Accessor<OpponentStagerInput>
): Accessor<PuzzleOpponentMoveStage> {
  const timers = useTimers();
  const { game } = usePuzzleGame();
  // The stager starts from the input as it stands; every later one reaches
  // it through `update`.
  const stager = createPuzzleOpponentStager(timers, game, untrack(args));
  onCleanup(() => stager.dispose());

  createEffect(args, (input) => {
    stager.update(input);
  });

  return createSubscriptionSignal(stager);
}
