import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared-ts/play-attr';
import { puzzleStatusKindFromState } from '@libs/game-puzzle-shared-ts/status-kind';
import { type Accessor, createMemo } from 'solid-js';
import type { PuzzleAttempt, PuzzleCoachLine } from './puzzle-client';
import { usePuzzleGame } from './puzzle-game-context';

/** The header's status kind for the attempt. */
export function usePuzzleStatusKind(
  status: Accessor<PuzzlePlayStatus | 'loading'>
) {
  return createMemo(() => puzzleStatusKindFromState({ status: status() }));
}

/** What the game's coach says about the attempt; nothing for a silent game. */
export function usePuzzleCoach(
  attempt: PuzzleAttempt
): Accessor<PuzzleCoachLine | null> {
  const { client } = usePuzzleGame();
  return createMemo(() => client.coach?.(attempt) ?? null);
}
