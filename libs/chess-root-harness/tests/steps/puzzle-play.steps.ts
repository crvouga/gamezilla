/**
 * Playing a puzzle: getting one on the board, moving, retrying, hints,
 * showing the solution, skipping, moving on, and what the board and the
 * attempt say afterwards.
 */

import { expect } from 'bun:test';
import {
  castlePuzzleKing,
  choosePuzzlePromotion,
  pickUpPuzzlePiece,
  playPuzzleMove,
  playUntilSolved,
  playWrongPuzzleMove,
} from '@libs/chess-puzzle-harness/chess-actions';
import {
  readPuzzleBoardDestinations,
  readPuzzleBoardPieceAt,
  readPuzzleBoardProbe,
} from '@libs/chess-puzzle-harness/chess-puzzle-solve-ui';
import { NAMED_PUZZLES } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import {
  readShownChessBoard,
  readShownChessPromotion,
} from '@libs/chess-root-harness/chess-board-reads';
import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
import {
  goBackToGamePuzzles,
  isPuzzleOfflineNoticeShown,
  isPuzzleSolved,
  leavePuzzleForGameChoices,
  moveOnToNextPuzzle,
  openGamePuzzlesNoWait,
  readPuzzleControls,
  readPuzzleHelp,
  readPuzzleOnBoard,
  readPuzzleProbe,
  readPuzzlePrompt,
  readPuzzleState,
  readPuzzleStatusKind,
  readPuzzleWatch,
  retryGamePuzzle,
  showPuzzleSolution,
  skipGamePuzzle,
  takePuzzleHint,
  takeSecondPuzzleHint,
} from '@libs/game-session-harness/puzzle-screen';
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
  ensureOnPuzzle,
  enterNamedPuzzle,
  enterPuzzles,
  lastMoveKey,
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

const solvedClockKey = (actor: Actor) => `clockAtSolve:${actor}`;

async function boardProbe(w: HarnessWorld, actor: Actor) {
  return required(
    await w.s.read(readShownChessBoard, actor),
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
  remember(w, lastMoveKey(actor), uci);
  await w.s.apply(playPuzzleMove, actor, uci);
}

// ------------------------------------------------------------ on the board

Given('{actor} is playing puzzles in their space', async (w, actor: Actor) => {
  await enterPuzzles(w, actor);
});

When('{actor} opens puzzles in their space', async (w, actor: Actor) => {
  // The board may not come (offline, empty): the Then steps wait for it.
  await w.s.apply(openGamePuzzlesNoWait, actor, CHESS_GAME_ID);
});

Given('{actor} has opened puzzles in their space', async (w, actor: Actor) => {
  await w.s.apply(openGamePuzzlesNoWait, actor, CHESS_GAME_ID);
  // Precondition guard: offline, the screen settles on its notice.
  await w.s.until((surf) => isPuzzleOfflineNoticeShown(surf, actor), {
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
    await w.s.until((surf) => isPuzzleOfflineNoticeShown(surf, actor), {
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
  await w.s.apply(focusActor, actor);
  const puzzleId = await w.s.until((s) => readPuzzleOnBoard(s, actor), {
    pred: (id) => id !== null,
    maxMs: SETTLE_MS,
  });
  expect(puzzleId).not.toBeNull();
});

Then(
  '{actor} has a puzzle on the board within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until(async (surf) => readPuzzleOnBoard(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (id) => id !== null,
    });
    await trackPuzzle(w, actor);
  }
);

Then('{actor} has no puzzle on the board', async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleOnBoard, actor)).toBeNull();
});

// ------------------------------------------------------------------ solving

/** Solve the puzzle, noting the clock at the solve for later steps. */
async function solve(w: HarnessWorld, actor: Actor): Promise<void> {
  await w.s.apply(focusActor, actor);
  await w.s.apply(playUntilSolved, actor);
  const probe = await w.s.read(readPuzzleWatch, actor);
  remember(w, solvedClockKey(actor), probe?.clockMs ?? null);
}

When('{actor} solves the puzzle', async (w, actor: Actor) => {
  await solve(w, actor);
});

Given('{actor} has solved the puzzle', async (w, actor: Actor) => {
  await ensureOnPuzzle(w, actor);
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
    await w.s.apply(retryGamePuzzle, actor);
    await waitSolverToMove(w, actor);
  }
);

Then('{actor} is told the move was wrong', async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleState, actor)).toBe('wrong');
});

Then(
  '{actor} is told the move was wrong within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until(async (surf) => readPuzzleState(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (status) => status === 'wrong',
    });
  }
);

When('{actor} retries the puzzle', async (w, actor: Actor) => {
  await w.s.apply(retryGamePuzzle, actor);
  await waitSolverToMove(w, actor);
});

Then(
  '{actor} is (still )asked to find the next move',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    expect(await w.s.read(readPuzzleState, actor)).toBe('solving');
  }
);

Then(
  '{actor} is asked to find the next move within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until(async (surf) => readPuzzleState(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (status) => status === 'solving',
    });
  }
);

// -------------------------------------------------------------------- hints

When('{actor} asks for a hint', async (w, actor: Actor) => {
  await w.s.apply(takePuzzleHint, actor);
});

Given('{actor} has taken a hint', async (w, actor: Actor) => {
  await w.s.apply(takePuzzleHint, actor);
});

When('{actor} asks for another hint', async (w, actor: Actor) => {
  await w.s.apply(takeSecondPuzzleHint, actor);
});

Then("{actor}'s hint highlights the piece to move", async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleHelp, actor)).toBe('highlight');
});

Then("{actor}'s hint shows the solution move", async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleHelp, actor)).toBe('solution');
});

When('{actor} shows the solution', async (w, actor: Actor) => {
  await w.s.apply(showPuzzleSolution, actor);
});

Given('{actor} has shown the solution', async (w, actor: Actor) => {
  await w.s.apply(showPuzzleSolution, actor);
  await w.s.until(async (surf) => readPuzzleProbe(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (debug) => debug?.status === 'revealed',
  });
});

Then(
  "{actor}'s puzzle shows the revealed solution within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await w.s.until(async (surf) => readPuzzleProbe(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (debug) => debug?.status === 'revealed',
    });
  }
);

Then(
  "{actor}'s board is at move {int} of the line within {int} seconds",
  async (w, actor: Actor, move: number, seconds: number) => {
    await w.s.until(async (surf) => readPuzzleProbe(surf, actor), {
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
        debug: await readPuzzleProbe(surf, actor),
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
    const from = recalled<string>(w, lastMoveKey(actor)).slice(0, 2);
    expect(await w.s.read(readShownChessPromotion, actor)).toMatchObject({
      from,
      to: square,
      color: 'w',
    });
  }
);

Then(
  '{actor} is asked which piece Black promotes to',
  async (w, actor: Actor) => {
    const uci = recalled<string>(w, lastMoveKey(actor));
    expect(await w.s.read(readShownChessPromotion, actor)).toMatchObject({
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
  '{actor} is solving the puzzle at move {int} of the line',
  async (w, actor: Actor, move: number) => {
    await waitSolverToMove(w, actor);
    expect(await w.s.read(readPuzzleProbe, actor)).toMatchObject({
      status: 'solving',
      solveIdx: move,
    });
  }
);

Then("{actor}'s board is unchanged", async (w, actor: Actor) => {
  expect((await boardProbe(w, actor)).fen).toBe(boardBefore(w, actor));
});

// ------------------------------------------------------ skipping and clock

Given('{actor} has skipped the puzzle', async (w, actor: Actor) => {
  await w.s.apply(skipGamePuzzle, actor);
});

Then("{actor}'s puzzle is skipped", async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleState, actor)).toBe('skipped');
  expect(await w.s.read(readPuzzleStatusKind, actor)).toBe('skipped');
});

When('{int} second(s) pass(es)', async (w, seconds: number) => {
  await w.s.advanceTime(seconds * SECOND_MS);
});

// ------------------------------------------------------------- moving on

When('{actor} moves on to the next puzzle', async (w, actor: Actor) => {
  await w.s.apply(moveOnToNextPuzzle, actor);
  await trackPuzzle(w, actor);
});

Given('{actor} has moved on to the next puzzle', async (w, actor: Actor) => {
  await w.s.apply(moveOnToNextPuzzle, actor);
  await trackPuzzle(w, actor);
});

Then(
  '{actor} is solving a different puzzle than the one before',
  async (w, actor: Actor) => {
    const before = required(previousPuzzle(w, actor), 'a puzzle before');
    expect(await activePuzzle(w, actor)).not.toBe(before);
    expect(await w.s.read(readPuzzleState, actor)).toBe('solving');
  }
);

Then(
  '{actor} is not offered the puzzle that is over',
  async (w, actor: Actor) => {
    // trackPuzzle on the way back moved the finished puzzle to "the one before".
    const over = required(previousPuzzle(w, actor), 'the puzzle that is over');
    expect(await w.s.read(readPuzzleOnBoard, actor)).not.toBe(over);
    expect(await w.s.read(isPuzzleSolved, actor)).toBe(false);
    expect((await w.s.read(readPuzzleControls, actor)).resultShown).toBe(false);
  }
);

Then('{actor} is on the same puzzle as before', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect(await w.s.read(readPuzzleOnBoard, actor)).toBe(
    currentPuzzle(w, actor)
  );
});

// ------------------------------------------------ leaving and coming back

Given(
  '{actor} has left the puzzle for the chess choices',
  async (w, actor: Actor) => {
    await w.s.apply(leavePuzzleForGameChoices, actor);
  }
);

When(
  '{actor} leaves the puzzle for the chess choices',
  async (w, actor: Actor) => {
    await w.s.apply(leavePuzzleForGameChoices, actor);
  }
);

When('{actor} goes back to the puzzles', async (w, actor: Actor) => {
  await w.s.apply(goBackToGamePuzzles, actor);
  // A puzzle on the board replaces the one tracked before the return.
  // The limit screen has none: do not invent one.
  if ((await w.s.read(readPuzzleOnBoard, actor)) !== null) {
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
