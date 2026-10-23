import type {
  OpponentStagerInput,
  OpponentStagerSnapshot,
} from '@libs/game-puzzle-shared-ts/opponent-stager';
import { createPuzzleOpponentStager } from '@libs/game-puzzle-shared-ts/opponent-stager';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { createSubscriptionSignal } from '@pkgs/solid-context-client-ts/subscription-signal';
import { type Accessor, createEffect, onCleanup } from 'solid-js';
import { usePuzzleGame } from './puzzle-game-context';

export type PuzzleOpponentMoveStage = OpponentStagerSnapshot;

export function usePuzzleOpponentMoveStage(
  args: Accessor<OpponentStagerInput>
): Accessor<PuzzleOpponentMoveStage> {
  const timers = useTimers();
  const { game } = usePuzzleGame();
  const stager = createPuzzleOpponentStager(timers, game, args());
  onCleanup(() => stager.dispose());

  createEffect(() => {
    stager.update(args());
  });

  return createSubscriptionSignal(stager);
}
