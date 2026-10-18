import type {
  OpponentStagerInput,
  OpponentStagerSnapshot,
} from '@libs/game-puzzle-shared/opponent-stager';
import { createPuzzleOpponentStager } from '@libs/game-puzzle-shared/opponent-stager';
import { useTimers } from '@pkgs/clock-client/solid';
import { createSubscriptionSignal } from '@pkgs/solid-context-client/subscription-signal';
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
