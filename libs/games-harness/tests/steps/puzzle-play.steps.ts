/**
 * Playing a puzzle of the run's game: onto the board, its moves, a wrong
 * move and a retry, hints, the shown solution, skipping, the clock, moving
 * on, and leaving and coming back. Every move and every expected position
 * is the game's known puzzle's, as its author wrote it.
 */

import { expect } from 'bun:test';
import {
  playKnownWrongMove,
  playNextKnownMove,
  playSolutionMove,
  reachKnownOpponentMove,
  reachKnownRefusedMove,
  solveKnownPuzzle,
  tryKnownOpponentMove,
  tryKnownRefusedMove,
} from '@libs/game-session-harness/puzzle-moves';
import {
  advancePuzzlesAfterASecond,
  askForNextPuzzle,
  askForNextPuzzleTwice,
  goBackToGamePuzzles,
  isPuzzleSolved,
  leavePuzzleForGameChoices,
  moveOnToNextPuzzle,
  readDeviceHaptics,
  readPuzzleBoardFacing,
  readPuzzleBoardPosition,
  readPuzzleControls,
  readPuzzleHelp,
  readPuzzleHighlightedMove,
  readPuzzleOnBoard,
  readPuzzleProbe,
  readPuzzlePrompt,
  readPuzzleState,
  readPuzzleWatch,
  retryGamePuzzle,
  retryGamePuzzleIfOffered,
  showPuzzleSolution,
  skipGamePuzzle,
  takePuzzleHint,
  takeSecondPuzzleHint,
} from '@libs/game-session-harness/puzzle-screen';
import { restartApp } from '@libs/harness/actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor, PuzzleFinishName } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { returnToOwnSpace } from '@libs/spaces-harness/space-actions';
import { gameOf } from './game-world';
import {
  boardBefore,
  currentPuzzle,
  ensureOnPuzzle,
  enterKnownPuzzle,
  enterPuzzles,
  focusPuzzle,
  lineOf,
  previousPuzzle,
  puzzleGameId,
  puzzleOn,
  rememberBoard,
  SECOND_MS,
  SETTLE_MS,
  trackPuzzle,
  writtenAs,
} from './puzzle-world';

const clockAtSolveKey = (actor: string) => `puzzle-clock-at-solve:${actor}`;
/** Memo key: who last played a move of the line on their board. */
const LAST_MOVER = 'puzzle-last-mover';

/** Solve the puzzle on the board, noting its clock at the solve. */
async function solve(w: HarnessWorld, actor: Actor): Promise<void> {
  await w.s.apply(focusActor, actor);
  await w.s.apply(solveKnownPuzzle, actor, puzzleGameId(w));
  w.memo.set(
    clockAtSolveKey(actor),
    (await w.s.read(readPuzzleWatch, actor))?.clockMs ?? null
  );
}

async function wrongMove(w: HarnessWorld, actor: Actor): Promise<void> {
  await w.s.apply(focusActor, actor);
  await w.s.apply(playKnownWrongMove, actor, puzzleGameId(w));
}

async function untilState(
  w: HarnessWorld,
  actor: Actor,
  state: string,
  maxMs = SETTLE_MS
): Promise<void> {
  await focusPuzzle(w, actor);
  await w.s.until((surf) => readPuzzleState(surf, actor), {
    maxMs,
    pred: (shown) => shown === state,
  });
}

// ------------------------------------------------------------ on the board

Given('{actor} is playing puzzles in their space', async (w, actor: Actor) => {
  await enterPuzzles(w, actor);
});

Given("{actor} is solving the game's known puzzle", async (w, actor: Actor) => {
  await enterKnownPuzzle(w, actor);
});

When("{actor} opens the game's known puzzle", async (w, actor: Actor) => {
  await enterKnownPuzzle(w, actor);
});

Then("{actor}'s board faces the solver's side", async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  expect(await w.s.read(readPuzzleBoardFacing, actor)).toBe(
    puzzleOn(w, actor).solverSide
  );
});

Then(
  "{actor}'s board shows the setup move as the last move",
  async (w, actor: Actor) => {
    await focusPuzzle(w, actor);
    const [setup = ''] = puzzleOn(w, actor).labels;
    expect(await w.s.read(readPuzzleHighlightedMove, actor)).toEqual({
      index: 0,
      text: writtenAs(w, setup),
    });
    expect(await w.s.read(readPuzzleBoardPosition, actor)).toBe(
      lineOf(w, puzzleOn(w, actor))[1] ?? null
    );
  }
);

Then(
  "{actor} is prompted to find the next move for the solver's side",
  async (w, actor: Actor) => {
    await focusPuzzle(w, actor);
    const side = gameOf(w).client.presentation.sideLabel(
      puzzleOn(w, actor).solverSide
    );
    const prompt = await w.s.read(readPuzzlePrompt, actor);
    expect(prompt).toContain(side);
    expect(prompt?.toLowerCase()).toContain('move');
  }
);

// ------------------------------------------------------------------ solving

When('{actor} solves the puzzle', async (w, actor: Actor) => {
  await solve(w, actor);
});

Given('{actor} has solved the puzzle', async (w, actor: Actor) => {
  await ensureOnPuzzle(w, actor);
  await solve(w, actor);
});

Then("{actor}'s puzzle is solved", async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  expect(await w.s.read(isPuzzleSolved, actor)).toBe(true);
});

Then(
  "{actor}'s puzzle is solved within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await focusPuzzle(w, actor);
    await w.s.until((surf) => isPuzzleSolved(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then("{actor}'s puzzle is not solved", async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  expect(await w.s.read(isPuzzleSolved, actor)).toBe(false);
});

When('{actor} plays the next move of the solution', async (w, actor: Actor) => {
  w.memo.set(LAST_MOVER, actor);
  await w.s.apply(focusActor, actor);
  await w.s.apply(playSolutionMove, actor, puzzleGameId(w));
});

Given(
  '{actor} has played the next move of the solution',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(playNextKnownMove, actor, puzzleGameId(w));
  }
);

When('{actor} plays the last move of the solution', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(playSolutionMove, actor, puzzleGameId(w));
});

Then(
  'the opponent replies with the next move of the line by itself',
  async (w) => {
    const actor = String(w.memo.get(LAST_MOVER));
    await focusPuzzle(w, actor);
    // The setup move, the solver's move and the reply: move 3 of the line.
    const replied = lineOf(w, puzzleOn(w, actor))[3];
    await w.s.until((surf) => readPuzzleBoardPosition(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (position) => position === replied,
    });
  }
);

Then(
  '{actor} is solving the puzzle at move {int} of the line',
  async (w, actor: Actor, move: number) => {
    await focusPuzzle(w, actor);
    const probe = await w.s.until((surf) => readPuzzleProbe(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (seen) => seen?.status === 'solving' && seen.interactive,
    });
    expect(probe?.solveIdx).toBe(move);
    expect(await w.s.read(readPuzzleBoardPosition, actor)).toBe(
      lineOf(w, puzzleOn(w, actor))[move] ?? null
    );
  }
);

// ------------------------------------------------------------ wrong moves

When('{actor} plays a wrong move', async (w, actor: Actor) => {
  await wrongMove(w, actor);
});

Given('{actor} has played a wrong move', async (w, actor: Actor) => {
  await ensureOnPuzzle(w, actor);
  await wrongMove(w, actor);
});

Given(
  '{actor} has played a wrong move and retried',
  async (w, actor: Actor) => {
    await ensureOnPuzzle(w, actor);
    await wrongMove(w, actor);
    await w.s.apply(retryGamePuzzle, actor);
  }
);

Given(
  '{actor} has played a wrong move and skipped the puzzle',
  async (w, actor: Actor) => {
    await ensureOnPuzzle(w, actor);
    await wrongMove(w, actor);
    await w.s.apply(skipGamePuzzle, actor);
  }
);

Then('{actor} is told the move was wrong', async (w, actor: Actor) => {
  await untilState(w, actor, 'wrong');
});

Then(
  '{actor} feels the {word} haptic',
  async (w, actor: Actor, haptic: string) => {
    expect(await w.s.read(readDeviceHaptics, actor)).toContain(haptic);
  }
);

When(
  "{actor} tries to make a move for the opponent's side",
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(reachKnownOpponentMove, actor, puzzleGameId(w));
    await rememberBoard(w, actor);
    await w.s.apply(tryKnownOpponentMove, actor, puzzleGameId(w));
  }
);

When(
  "{actor} tries a move the game's rules do not allow",
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(reachKnownRefusedMove, actor, puzzleGameId(w));
    await rememberBoard(w, actor);
    await w.s.apply(tryKnownRefusedMove, actor, puzzleGameId(w));
  }
);

Then("{actor}'s board is unchanged", async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  expect(await w.s.read(readPuzzleBoardPosition, actor)).toBe(
    boardBefore(w, actor)
  );
});

Then(
  '{actor} is (still )asked to find the next move',
  async (w, actor: Actor) => {
    await focusPuzzle(w, actor);
    expect(await w.s.read(readPuzzleState, actor)).toBe('solving');
  }
);

Then(
  '{actor} is asked to find the next move within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await untilState(w, actor, 'solving', seconds * SECOND_MS);
  }
);

// ----------------------------------------------------------------- retrying

When('{actor} retries the puzzle', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(retryGamePuzzle, actor);
});

When(
  '{actor} tries to retry before a wrong move or result',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(retryGamePuzzleIfOffered, actor);
  }
);

Then('{actor} is not offered to retry', async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  expect((await w.s.read(readPuzzleControls, actor)).retryOffered).toBe(false);
});

// -------------------------------------------------------------------- hints

When('{actor} asks for a hint', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(takePuzzleHint, actor);
});

Given('{actor} has taken a hint', async (w, actor: Actor) => {
  await ensureOnPuzzle(w, actor);
  await w.s.apply(takePuzzleHint, actor);
});

Given('{actor} has taken two hints', async (w, actor: Actor) => {
  await ensureOnPuzzle(w, actor);
  await w.s.apply(takePuzzleHint, actor);
  await w.s.apply(takeSecondPuzzleHint, actor);
});

When('{actor} asks for another hint', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(takeSecondPuzzleHint, actor);
});

Then(
  "{actor}'s hint highlights where the solution move starts",
  async (w, actor: Actor) => {
    await focusPuzzle(w, actor);
    expect(await w.s.read(readPuzzleHelp, actor)).toBe('highlight');
  }
);

Then("{actor}'s hint shows the solution move", async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  expect(await w.s.read(readPuzzleHelp, actor)).toBe('solution');
});

// ------------------------------------------------- the solution, skipping

When('{actor} shows the solution', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(showPuzzleSolution, actor);
});

Given('{actor} has shown the solution', async (w, actor: Actor) => {
  await ensureOnPuzzle(w, actor);
  await w.s.apply(showPuzzleSolution, actor);
});

Then(
  "{actor}'s puzzle shows the revealed solution within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await untilState(w, actor, 'revealed', seconds * SECOND_MS);
  }
);

Then(
  "{actor}'s board is at move {int} of the line within {int} seconds",
  async (w, actor: Actor, move: number, seconds: number) => {
    await focusPuzzle(w, actor);
    const at = lineOf(w, puzzleOn(w, actor))[move];
    await w.s.until(
      async (surf) => ({
        move: (await readPuzzleProbe(surf, actor))?.solveIdx,
        position: await readPuzzleBoardPosition(surf, actor),
      }),
      {
        maxMs: seconds * SECOND_MS,
        pred: (shown) => shown.move === move && shown.position === at,
      }
    );
  }
);

When('{actor} skips the puzzle', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(skipGamePuzzle, actor);
});

Given('{actor} has skipped the puzzle', async (w, actor: Actor) => {
  await ensureOnPuzzle(w, actor);
  await w.s.apply(skipGamePuzzle, actor);
});

Then("{actor}'s puzzle is skipped", async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  expect(await w.s.read(readPuzzleState, actor)).toBe('skipped');
  expect((await w.s.read(readPuzzleWatch, actor))?.statusKind).toBe('skipped');
});

Then(
  "{actor}'s puzzle remains {word}",
  async (w, actor: Actor, state: string) => {
    await focusPuzzle(w, actor);
    expect(await w.s.read(readPuzzleState, actor)).toBe(state);
  }
);

Given(
  '{actor} has finished this puzzle by {finish}',
  async (w, actor: Actor, finish: PuzzleFinishName) => {
    await ensureOnPuzzle(w, actor);
    if (finish === 'hintThenSolve') await w.s.apply(takePuzzleHint, actor);
    if (finish === 'wrongRetrySolve') {
      await wrongMove(w, actor);
      await w.s.apply(retryGamePuzzle, actor);
    }
    if (finish === 'showSolution') await w.s.apply(showPuzzleSolution, actor);
    else if (finish === 'skip') await w.s.apply(skipGamePuzzle, actor);
    else await solve(w, actor);
  }
);

// --------------------------------------------------------------- the clock

Then(
  "{actor}'s puzzle clock shows at least {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await focusPuzzle(w, actor);
    const clock = (await w.s.read(readPuzzleWatch, actor))?.clockMs;
    expect(clock).toBeGreaterThanOrEqual(seconds * SECOND_MS);
  }
);

Then(
  "{actor}'s puzzle clock has not moved since the solve",
  async (w, actor: Actor) => {
    await focusPuzzle(w, actor);
    const watch = await w.s.read(readPuzzleWatch, actor);
    expect(watch?.statusKind).toBe('solved');
    expect(watch?.clockMs).toBe(
      w.memo.get(clockAtSolveKey(actor)) as number | null
    );
  }
);

// --------------------------------------------------------------- moving on

When('{actor} asks for the next puzzle', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(askForNextPuzzle, actor);
});

Then('{actor} is not offered to move on', async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  const controls = await w.s.read(readPuzzleControls, actor);
  expect(controls.moveOnOffered).toBe(false);
  expect(controls.resultMoveOnOffered).toBe(false);
});

When('{actor} moves on to the next puzzle', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(moveOnToNextPuzzle, actor);
  await trackPuzzle(w, actor);
});

When(
  '{actor} asks for the next puzzle twice in quick succession',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(askForNextPuzzleTwice, actor);
    await trackPuzzle(w, actor);
  }
);

Then(
  '{actor} is solving a different puzzle than the one before',
  async (w, actor: Actor) => {
    await focusPuzzle(w, actor);
    expect(await w.s.read(readPuzzleOnBoard, actor)).not.toBe(
      previousPuzzle(w, actor)
    );
    expect(await w.s.read(readPuzzleState, actor)).toBe('solving');
  }
);

Then('{actor} is on the same puzzle as before', async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  expect(await w.s.read(readPuzzleOnBoard, actor)).toBe(
    currentPuzzle(w, actor)
  );
});

Then(
  '{actor} is on a different puzzle than the one before within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    const before = currentPuzzle(w, actor);
    await focusPuzzle(w, actor);
    await w.s.until((surf) => readPuzzleOnBoard(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (id) => id !== null && id !== before,
    });
    await trackPuzzle(w, actor);
  }
);

Then(
  '{actor} is not offered the puzzle that is over',
  async (w, actor: Actor) => {
    await focusPuzzle(w, actor);
    // Going back tracked the new puzzle: the one over is "the one before".
    expect(await w.s.read(readPuzzleOnBoard, actor)).not.toBe(
      previousPuzzle(w, actor)
    );
    expect(await w.s.read(isPuzzleSolved, actor)).toBe(false);
    expect((await w.s.read(readPuzzleControls, actor)).resultShown).toBe(false);
  }
);

Given(
  '{actor} has puzzles set to advance 1 second after a solve',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(advancePuzzlesAfterASecond, actor);
  }
);

// ------------------------------------------------ leaving and coming back

Given(
  "{actor} has left the puzzle for the game's choices",
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(leavePuzzleForGameChoices, actor);
  }
);

When('{actor} goes back to the puzzles', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(goBackToGamePuzzles, actor);
  await trackPuzzle(w, actor);
});

When('{actor} reopens the app on the puzzle', async (w, actor: Actor) => {
  await w.s.apply(restartApp, actor);
  await w.s.apply(returnToOwnSpace, actor);
});
