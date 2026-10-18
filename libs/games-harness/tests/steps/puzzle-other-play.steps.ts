/**
 * Other play beside the run's game's puzzles: being paired up for a matched
 * game leaves the space's puzzle as it was, and a rated puzzle start of
 * another game offering puzzles counts toward the same daily puzzle limit.
 */

import { expect } from 'bun:test';
import { useUpPuzzleStartsToday } from '@libs/game-session-harness/puzzle-allowance';
import { solveKnownPuzzle } from '@libs/game-session-harness/puzzle-moves';
import {
  leavePuzzleForGameChoices,
  openGamePuzzles,
  readPuzzleBoardPosition,
  readPuzzleOnBoard,
  returnToGamePuzzles,
} from '@libs/game-session-harness/puzzle-screen';
import { attemptGoBackToGameChoice } from '@libs/game-session-harness/space-game-choice';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { anotherGame, joinHostsSpace } from './game-world';
import { pairedAt } from './matched-game';
import {
  enterPuzzles,
  puzzleGameId,
  required,
  SETTLE_MS,
  solverToMove,
  withAccount,
} from './puzzle-world';

/** Memo key: the puzzle and position on the space's board, as it was. */
const SPACE_PUZZLE = 'puzzle-other-play:space-puzzle';

/** Someone `host` is paired up with, never one of the scenario's people. */
const OPPONENT = 'charlie';

type SpacePuzzle = readonly [string | null, string | null];

async function spacePuzzleOf(
  w: HarnessWorld,
  actor: Actor
): Promise<SpacePuzzle> {
  return [
    await w.s.read(readPuzzleOnBoard, actor),
    await w.s.read(readPuzzleBoardPosition, actor),
  ];
}

Given(
  '{actor} and {actor} are playing a puzzle in a space',
  async (w, host: Actor, watcher: Actor) => {
    await withAccount(w, host);
    await withAccount(w, watcher);
    await enterPuzzles(w, host);
    await solverToMove(w, host);
    const shown = await spacePuzzleOf(w, host);
    await joinHostsSpace(w, host, watcher);
    // Precondition guard: both boards show the space's puzzle.
    await w.s.apply(focusActor, watcher);
    await w.s.until(
      async (surf) => [
        await readPuzzleOnBoard(surf, watcher),
        await readPuzzleBoardPosition(surf, watcher),
      ],
      {
        maxMs: SETTLE_MS,
        pred: (seen) => seen[0] === shown[0] && seen[1] === shown[1],
      }
    );
    w.memo.set(SPACE_PUZZLE, shown);
  }
);

Given(
  '{actor} has been paired up with an opponent for the game at {word}',
  async (w, actor: Actor, clock: string) => {
    await pairedAt(w, actor, OPPONENT, clock);
  }
);

When('{actor} returns to the puzzle in the space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(returnToGamePuzzles, actor, puzzleGameId(w));
});

Then('{actor} keeps the same puzzle in the space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect(await spacePuzzleOf(w, actor)).toEqual(
    required(
      w.memo.get(SPACE_PUZZLE) as SpacePuzzle | undefined,
      "the space's puzzle as it was"
    )
  );
});

Given(
  '{actor} is a guest who has played {int} rated puzzles of another game offering puzzles today',
  async (w, actor: Actor, played: number) => {
    const other = anotherGame(w, 'puzzles').shared.id;
    await joinHostsSpace(w, actor, actor);
    await w.s.apply(openGamePuzzles, actor, other);
    await w.s.apply(useUpPuzzleStartsToday, actor, played);
    await w.s.apply(solveKnownPuzzle, actor, other);
    // Back to the space's game choice, where any game may be picked.
    await w.s.apply(leavePuzzleForGameChoices, actor);
    await w.s.apply(attemptGoBackToGameChoice, actor, other);
  }
);
