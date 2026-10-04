/**
 * Playing a puzzle: getting one on the board, moving, retrying, hints,
 * showing the solution, skipping, moving on, and what the board and the
 * attempt say afterwards.
 */

import { expect } from 'bun:test';

import {
  castlePuzzleKing,
  choosePuzzlePromotion,
  leavePuzzleToChessMenu,
  openPuzzleFromSpaceNoWait,
  pickUpPuzzlePiece,
  playPuzzleMove,
  playUntilSolved,
  playWrongPuzzleMove,
  pressPuzzleNext,
  pressPuzzleNextIfVisible,
  pressPuzzleNextTwice,
  requestPuzzleHint,
  retryPuzzle,
  returnToPuzzleScreen,
  revealPuzzleSolution,
  setPuzzleAutoAdvance,
  showPuzzleSolutionLine,
  skipPuzzle,
} from '@libs/chess-puzzle-harness/chess-actions';
import {
  readPuzzleBoardDestinations,
  readPuzzleBoardPieceAt,
  readPuzzleBoardProbe,
  readPuzzleHaptics,
  readPuzzlePromotionPending,
  readPuzzlePrompt,
} from '@libs/chess-puzzle-harness/chess-puzzle-solve-ui';
import {
  isPuzzleOfflineNoticeVisible,
  isPuzzleSolved,
  readActivePuzzleId,
  readPuzzleDebug,
  readPuzzleHintStage,
  readPuzzleSpectator,
  readPuzzleStatus,
  readPuzzleStatusKind,
} from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import { readPuzzleControlAvailability } from '@libs/chess-puzzle-harness/puzzle-control-reads';
import { NAMED_PUZZLES } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import { restoreNetwork } from '@libs/harness/actions';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { cutConnection } from '@libs/harness/platform';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { remember } from '@libs/harness/spec-world';
import { createSpace } from '@libs/spaces-harness/space-actions';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import { markPuzzleSoundBoundary } from './puzzle-sound-evidence';
import {
  activePuzzle,
  boardBefore,
  currentPuzzle,
  enterNamedPuzzle,
  enterPuzzles,
  previousPuzzle,
  promotionPiece,
  recalled,
  rememberBoard,
  required,
  SECOND_MS,
  SETTLE_MS,
  sideOf,
  trackPuzzle,
  uciOf,
  waitSolverToMove,
} from './puzzle-world';

const moveKey = (actor: Actor) => `lastMove:${actor}`;
const solvedClockKey = (actor: Actor) => `clockAtSolve:${actor}`;
const LAST_MOVER = 'lastMover';

function lastMover(w: HarnessWorld): Actor {
  return recalled<Actor>(w, LAST_MOVER);
}

async function boardProbe(w: HarnessWorld, actor: Actor) {
  return required(
    await w.s.read(readPuzzleBoardProbe, actor),
    `${actor}'s board`
  );
}

/** Move once the solver may, remembering the position the move started from. */
async function playMove(
  w: HarnessWorld,
  actor: Actor,
  move: string
): Promise<void> {
  const uci = uciOf(move);
  await waitSolverToMove(w, actor);
  await rememberBoard(w, actor);
  await markPuzzleSoundBoundary(w, actor);
  remember(w, moveKey(actor), uci);
  remember(w, LAST_MOVER, actor);
  await w.s.apply(playPuzzleMove, actor, uci);
}

// ------------------------------------------------------------ on the board

Given('{actor} is playing puzzles in their space', async (w, actor: Actor) => {
  await enterPuzzles(w, actor);
});

When('{actor} opens puzzles in their space', async (w, actor: Actor) => {
  // The board may not come (offline, empty): the Then steps wait for it.
  await w.s.apply(openPuzzleFromSpaceNoWait, actor);
});

Given('{actor} has opened puzzles in their space', async (w, actor: Actor) => {
  await w.s.apply(openPuzzleFromSpaceNoWait, actor);
  // Precondition guard: offline, the screen settles on its notice.
  await w.s.until((surf) => isPuzzleOfflineNoticeVisible(surf, actor), {
    maxMs: SETTLE_MS,
  });
});

Given(
  '{actor} went offline before any puzzles reached their device',
  async (w, actor: Actor) => {
    await w.s.apply(createSpace, actor);
    await cutConnection(w, actor);
  }
);

Then(
  '{actor} is told puzzles need a connection within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((surf) => isPuzzleOfflineNoticeVisible(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Given(
  '{actor} is solving the four-move mate-in-two puzzle',
  async (w, actor: Actor) => {
    await enterNamedPuzzle(w, actor, NAMED_PUZZLES.fourMoveMateInTwo);
  }
);

Given(
  '{actor} is solving the underpromotion puzzle',
  async (w, actor: Actor) => {
    await enterNamedPuzzle(w, actor, NAMED_PUZZLES.underpromotion);
  }
);

Given(
  '{actor} is solving the capture-promotion puzzle',
  async (w, actor: Actor) => {
    await enterNamedPuzzle(w, actor, NAMED_PUZZLES.capturePromotion);
  }
);

Given('{actor} is solving the en passant puzzle', async (w, actor: Actor) => {
  await enterNamedPuzzle(w, actor, NAMED_PUZZLES.enPassant);
});

Given('{actor} is solving the castling puzzle', async (w, actor: Actor) => {
  await enterNamedPuzzle(w, actor, NAMED_PUZZLES.castling);
});

Given(
  '{actor} is solving the puzzle with more than one mate on the final move',
  async (w, actor: Actor) => {
    await enterNamedPuzzle(w, actor, NAMED_PUZZLES.moreThanOneMate);
  }
);

Given('{actor} is solving the hook-mate puzzle', async (w, actor: Actor) => {
  await enterNamedPuzzle(w, actor, NAMED_PUZZLES.hookMate);
});

Given(
  '{actor} is solving the two-rook clearance puzzle',
  async (w, actor: Actor) => {
    await enterNamedPuzzle(w, actor, NAMED_PUZZLES.twoRookClearance);
  }
);

Given(
  '{actor} is solving the puzzle Black solves by promoting',
  async (w, actor: Actor) => {
    await enterNamedPuzzle(w, actor, NAMED_PUZZLES.blackPromotes);
  }
);

Given(
  '{actor} is solving the puzzle that starts with White in check',
  async (w, actor: Actor) => {
    await enterNamedPuzzle(w, actor, NAMED_PUZZLES.whiteInCheck);
  }
);

Then('{actor} has a puzzle on the board', async (w, actor: Actor) => {
  expect(await w.s.read(readActivePuzzleId, actor)).not.toBeNull();
});

Then(
  '{actor} has a puzzle on the board within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until(async (surf) => readActivePuzzleId(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (id) => id !== null,
    });
    await trackPuzzle(w, actor);
  }
);

Then('{actor} has no puzzle on the board', async (w, actor: Actor) => {
  expect(await w.s.read(readActivePuzzleId, actor)).toBeNull();
});

// ------------------------------------------------------------------ solving

/** Solve the puzzle, noting the clock at the solve for later steps. */
async function solve(w: HarnessWorld, actor: Actor): Promise<void> {
  await w.s.apply(focusActor, actor);
  await w.s.apply(playUntilSolved, actor);
  const probe = await w.s.read(readPuzzleSpectator, actor);
  remember(w, solvedClockKey(actor), probe?.clockMs ?? null);
}

When('{actor} solves the puzzle', async (w, actor: Actor) => {
  await solve(w, actor);
});

Given('{actor} has solved the puzzle', async (w, actor: Actor) => {
  await solve(w, actor);
});

Then("{actor}'s puzzle is solved", async (w, actor: Actor) => {
  expect(await w.s.read(isPuzzleSolved, actor)).toBe(true);
});

Then(
  "{actor}'s puzzle is solved within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((surf) => isPuzzleSolved(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then("{actor}'s puzzle is not solved", async (w, actor: Actor) => {
  expect(await w.s.read(isPuzzleSolved, actor)).toBe(false);
});

When('{actor} plays a wrong move', async (w, actor: Actor) => {
  await markPuzzleSoundBoundary(w, actor);
  await w.s.apply(playWrongPuzzleMove, actor);
});

Given('{actor} has played a wrong move', async (w, actor: Actor) => {
  await w.s.apply(playWrongPuzzleMove, actor);
});

Given(
  '{actor} has played a wrong move and retried',
  async (w, actor: Actor) => {
    await w.s.apply(playWrongPuzzleMove, actor);
    await w.s.apply(retryPuzzle, actor);
    await waitSolverToMove(w, actor);
  }
);

Given(
  '{actor} has played a wrong move and skipped the puzzle',
  async (w, actor: Actor) => {
    await w.s.apply(playWrongPuzzleMove, actor);
    await w.s.apply(skipPuzzle, actor);
  }
);

Then('{actor} is told the move was wrong', async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleStatus, actor)).toBe('wrong');
});

Then(
  '{actor} is told the move was wrong within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until(async (surf) => readPuzzleStatus(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (status) => status === 'wrong',
    });
  }
);

When('{actor} retries the puzzle', async (w, actor: Actor) => {
  await w.s.apply(retryPuzzle, actor);
  await waitSolverToMove(w, actor);
});

Then(
  '{actor} is (still )asked to find the next move',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    expect(await w.s.read(readPuzzleStatus, actor)).toBe('solving');
  }
);

Then(
  '{actor} is asked to find the next move within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until(async (surf) => readPuzzleStatus(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (status) => status === 'solving',
    });
  }
);

Then('{actor} cannot move pieces', async (w, actor: Actor) => {
  expect((await boardProbe(w, actor)).interactive).toBe(false);
});

// -------------------------------------------------------------------- hints

When('{actor} asks for a hint', async (w, actor: Actor) => {
  await w.s.apply(requestPuzzleHint, actor);
});

Given('{actor} has taken a hint', async (w, actor: Actor) => {
  await w.s.apply(requestPuzzleHint, actor);
});

Given('{actor} has taken two hints', async (w, actor: Actor) => {
  await w.s.apply(requestPuzzleHint, actor);
  await w.s.apply(revealPuzzleSolution, actor);
});

When('{actor} asks for another hint', async (w, actor: Actor) => {
  await w.s.apply(revealPuzzleSolution, actor);
});

Then("{actor}'s hint highlights the piece to move", async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleHintStage, actor)).toBe('highlight');
});

Then("{actor}'s hint shows the solution move", async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleHintStage, actor)).toBe('solution');
});

When('{actor} shows the solution', async (w, actor: Actor) => {
  await w.s.apply(showPuzzleSolutionLine, actor);
});

Given('{actor} has shown the solution', async (w, actor: Actor) => {
  await w.s.apply(showPuzzleSolutionLine, actor);
  await w.s.until(async (surf) => readPuzzleDebug(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (debug) => debug?.status === 'revealed',
  });
});

Then(
  "{actor}'s puzzle shows the revealed solution within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await w.s.until(async (surf) => readPuzzleDebug(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (debug) => debug?.status === 'revealed',
    });
  }
);

Then(
  "{actor}'s board is at move {int} of the line within {int} seconds",
  async (w, actor: Actor, move: number, seconds: number) => {
    await w.s.until(async (surf) => readPuzzleDebug(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (debug) => debug?.solveIdx === move,
    });
  }
);

Then(
  "{actor}'s board reaches checkmate at move {int} of the line within {int} seconds",
  async (w, actor: Actor, move: number, seconds: number) => {
    await w.s.until(
      async (surf) => ({
        debug: await readPuzzleDebug(surf, actor),
        probe: await readPuzzleBoardProbe(surf, actor),
      }),
      {
        maxMs: seconds * SECOND_MS,
        pred: ({ debug, probe }) =>
          debug?.solveIdx === move && probe?.status === 'checkmate',
      }
    );
  }
);

// ------------------------------------------------------------------- moves

// regression: merge-puzzle-move-wording — Alice plays a1-a5
When(
  '{actor} plays (the move ){word}',
  async (w, actor: Actor, move: string) => {
    await playMove(w, actor, move);
  }
);
Given('{actor} has played {word}', async (w, actor: Actor, move: string) => {
  await playMove(w, actor, move);
});

When(
  '{actor} plays (the move ){word} and promotes to a {word}',
  async (w, actor: Actor, move: string, piece: string) => {
    await playMove(w, actor, move);
    await w.s.apply(choosePuzzlePromotion, actor, promotionPiece(piece));
  }
);

When(
  "{actor} tries to move the opponent's piece {word}",
  async (w, actor: Actor, move: string) => {
    await playMove(w, actor, move);
  }
);

When(
  '{actor} tries the illegal move {word}',
  async (w, actor: Actor, move: string) => {
    await playMove(w, actor, move);
  }
);

When(
  '{actor} picks up the rook on {word}',
  async (w, actor: Actor, square: string) => {
    await waitSolverToMove(w, actor);
    await w.s.apply(pickUpPuzzlePiece, actor, square as Square);
  }
);

Then(
  "{actor}'s board shows the rook on {word} can go to {squares}",
  async (w, actor: Actor, square: string, squares: readonly Square[]) => {
    expect(
      await w.s.read(readPuzzleBoardPieceAt, actor, square as Square)
    ).toBe('wr');
    expect(await w.s.read(readPuzzleBoardDestinations, actor)).toEqual(squares);
  }
);

When(
  '{actor} castles by moving the king onto its own rook',
  async (w, actor: Actor) => {
    await w.s.apply(castlePuzzleKing, actor, 'ontoRook');
  }
);

When(
  '{actor} castles by moving the king two squares',
  async (w, actor: Actor) => {
    await w.s.apply(castlePuzzleKing, actor, 'twoSquares');
  }
);

Then(
  '{actor} is asked which piece White promotes to on {word}',
  async (w, actor: Actor, square: string) => {
    const from = recalled<string>(w, moveKey(actor)).slice(0, 2);
    expect(await w.s.read(readPuzzlePromotionPending, actor)).toMatchObject({
      from,
      to: square,
      color: 'w',
    });
  }
);

Then(
  '{actor} is asked which piece Black promotes to',
  async (w, actor: Actor) => {
    const uci = recalled<string>(w, moveKey(actor));
    expect(await w.s.read(readPuzzlePromotionPending, actor)).toMatchObject({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      color: 'b',
    });
  }
);

Then("{actor}'s board faces {word}", async (w, actor: Actor, side: string) => {
  const orientation = sideOf(side) === 'w' ? 'white' : 'black';
  expect((await boardProbe(w, actor)).orientation).toBe(orientation);
});

Then(
  "it is {word}'s move on {actor}'s board",
  async (w, side: string, actor: Actor) => {
    expect((await boardProbe(w, actor)).turn).toBe(sideOf(side));
  }
);

Then(
  "{word} is in check and to move on {actor}'s board",
  async (w, side: string, actor: Actor) => {
    expect(await boardProbe(w, actor)).toMatchObject({
      inCheck: true,
      turn: sideOf(side),
    });
  }
);

Then(
  '{actor} is prompted to find the next move for {word}',
  async (w, actor: Actor, side: string) => {
    const prompt = required(
      await w.s.read(readPuzzlePrompt, actor),
      'move prompt'
    );
    expect(prompt).toContain(side);
    expect(prompt.toLowerCase()).toContain('move');
  }
);

Then(
  "{actor}'s board shows {word} as the last move",
  async (w, actor: Actor, move: string) => {
    const uci = uciOf(move);
    const last = (await boardProbe(w, actor)).lastMove;
    expect(`${last?.from ?? ''}${last?.to ?? ''}`).toBe(uci);
  }
);

Then('the opponent replies {word} by itself', async (w, reply: string) => {
  const actor = lastMover(w);
  const uci = uciOf(reply);
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  // The reply plays itself: its piece leaves one square for the other.
  await w.s.until(
    async (surf) => ({
      from: await readPuzzleBoardPieceAt(surf, actor, from),
      to: await readPuzzleBoardPieceAt(surf, actor, to),
    }),
    {
      maxMs: SETTLE_MS,
      pred: (squares) => squares.from === null && squares.to !== null,
    }
  );
});

Then(
  '{actor} is solving the puzzle at move {int} of the line',
  async (w, actor: Actor, move: number) => {
    await waitSolverToMove(w, actor);
    expect(await w.s.read(readPuzzleDebug, actor)).toMatchObject({
      status: 'solving',
      solveIdx: move,
    });
  }
);

Then("{actor}'s board is unchanged", async (w, actor: Actor) => {
  expect((await boardProbe(w, actor)).fen).toBe(boardBefore(w, actor));
});

Then(
  '{actor} feels the {word} haptic',
  async (w, actor: Actor, haptic: string) => {
    expect(await w.s.read(readPuzzleHaptics, actor)).toContain(haptic);
  }
);

// ------------------------------------------------------ skipping and clock

When('{actor} skips the puzzle', async (w, actor: Actor) => {
  await w.s.apply(skipPuzzle, actor);
});

Given('{actor} has skipped the puzzle', async (w, actor: Actor) => {
  await w.s.apply(skipPuzzle, actor);
});

Then("{actor}'s puzzle is skipped", async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleStatus, actor)).toBe('skipped');
  expect(await w.s.read(readPuzzleStatusKind, actor)).toBe('skipped');
});

When('{int} second(s) pass(es)', async (w, seconds: number) => {
  await w.s.advanceTime(seconds * SECOND_MS);
});

async function readClock(w: HarnessWorld, actor: Actor): Promise<number> {
  const probe = await w.s.read(readPuzzleSpectator, actor);
  return required(probe?.clockMs, `${actor}'s puzzle clock`);
}

Then(
  "{actor}'s puzzle clock shows at least {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    const clock = await readClock(w, actor);
    expect(clock).toBeGreaterThanOrEqual(seconds * SECOND_MS);
  }
);

Then(
  "{actor}'s puzzle clock has not moved since the solve",
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleStatusKind, actor)).toBe('solved');
    expect(await readClock(w, actor)).toBe(
      required(
        recalled<number | null>(w, solvedClockKey(actor)),
        'clock at solve'
      )
    );
  }
);

// ------------------------------------------------------------- moving on

When('{actor} asks for the next puzzle', async (w, actor: Actor) => {
  await w.s.apply(pressPuzzleNextIfVisible, actor);
});

Then('{actor} is not offered to move on', async (w, actor: Actor) => {
  expect(
    (await w.s.read(readPuzzleControlAvailability, actor)).moveOnOffered
  ).toBe(false);
  expect(
    (await w.s.read(readPuzzleControlAvailability, actor)).summaryMoveOnOffered
  ).toBe(false);
});

When('{actor} moves on to the next puzzle', async (w, actor: Actor) => {
  await w.s.apply(pressPuzzleNext, actor);
  await trackPuzzle(w, actor);
});

Given('{actor} has moved on to the next puzzle', async (w, actor: Actor) => {
  await w.s.apply(pressPuzzleNext, actor);
  await trackPuzzle(w, actor);
});

When(
  '{actor} asks for the next puzzle twice in quick succession',
  async (w, actor: Actor) => {
    await w.s.apply(pressPuzzleNextTwice, actor);
    await trackPuzzle(w, actor);
  }
);

Then(
  '{actor} is solving a different puzzle than the one before',
  async (w, actor: Actor) => {
    const before = required(previousPuzzle(w, actor), 'a puzzle before');
    expect(await activePuzzle(w, actor)).not.toBe(before);
    expect(await w.s.read(readPuzzleStatus, actor)).toBe('solving');
  }
);

Then(
  '{actor} is not offered the puzzle that is over',
  async (w, actor: Actor) => {
    // trackPuzzle on the way back moved the finished puzzle to "the one before".
    const over = required(previousPuzzle(w, actor), 'the puzzle that is over');
    expect(await w.s.read(readActivePuzzleId, actor)).not.toBe(over);
    expect(await w.s.read(isPuzzleSolved, actor)).toBe(false);
    expect(
      (await w.s.read(readPuzzleControlAvailability, actor))
        .resultSummaryVisible
    ).toBe(false);
  }
);

Then(
  '{actor} is on a different puzzle than the one before within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    const before = currentPuzzle(w, actor);
    await w.s.until(async (surf) => readActivePuzzleId(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (id) => id !== null && id !== before,
    });
    await trackPuzzle(w, actor);
  }
);

Then('{actor} is on the same puzzle as before', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect(await w.s.read(readActivePuzzleId, actor)).toBe(
    currentPuzzle(w, actor)
  );
});

Given(
  '{actor} has puzzles set to advance 1 second after a solve',
  async (w, actor: Actor) => {
    await w.s.apply(setPuzzleAutoAdvance, actor, 'after1s');
  }
);
// ------------------------------------------------ leaving and coming back

Given(
  '{actor} has left the puzzle for the chess choices',
  async (w, actor: Actor) => {
    await w.s.apply(leavePuzzleToChessMenu, actor);
  }
);

When(
  '{actor} leaves the puzzle for the chess choices',
  async (w, actor: Actor) => {
    await w.s.apply(leavePuzzleToChessMenu, actor);
  }
);

When('{actor} goes back to the puzzles', async (w, actor: Actor) => {
  await w.s.apply(returnToPuzzleScreen, actor);
  // A puzzle on the board replaces the one tracked before the return.
  // The limit screen has none: do not invent one.
  if ((await w.s.read(readActivePuzzleId, actor)) !== null) {
    await trackPuzzle(w, actor);
  }
});

// ------------------------------------------------------------------ account

Given(
  '{actor} has since come back online and signed in with Google',
  async (w, actor: Actor) => {
    await w.s.apply(restoreNetwork);
    await w.s.apply(signInWithGoogle, actor);
  }
);
