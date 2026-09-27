/**
 * Playing a puzzle: getting one on the board, moving, retrying, hints,
 * showing the solution, skipping, moving on, and what the board and the
 * attempt say afterwards.
 */

import { expect } from 'bun:test';

import {
  choosePuzzlePromotion,
  leavePuzzleToChessMenu,
  openPuzzleFromSpace,
  playPuzzleMove,
  playUntilSolved,
  playWrongPuzzleMove,
  pressPuzzleNext,
  pressPuzzleNextNoWait,
  pressPuzzleNextTwice,
  requestPuzzleHint,
  retryPuzzle,
  returnToPuzzleScreen,
  revealPuzzleSolution,
  setPuzzleAutoAdvance,
  showPuzzleSolutionLine,
  skipPuzzle,
} from '@libs/chess/sim/chess-actions';
import {
  countPuzzleStarts,
  readPuzzleBoardProbe,
  readPuzzleHaptics,
  readPuzzleInteractions,
  readPuzzleOutcomes,
  readPuzzlePromotionPending,
  readPuzzlePrompt,
} from '@libs/chess/sim/chess-puzzle-solve-ui';
import {
  isPuzzleSolved,
  readActivePuzzleId,
  readNextPuzzleId,
  readPuzzleDebug,
  readPuzzleHintStage,
  readPuzzleSpectator,
  readPuzzleStatus,
  readPuzzleStatusKind,
} from '@libs/chess/sim/chess-puzzle-ui';
import { focusActor } from '@libs/sim-harness';
import { type Actor, Given, Then, When } from '@libs/sim-harness/spec/define';
import { remember } from '@libs/sim-harness/spec/world';
import { accountIdOf } from '@libs/sim-harness/system/identity';
import { reenterActiveSpace } from '@libs/spaces/sim/space-actions';
import { Chess } from 'chess.js';
import { NAMED_PUZZLES } from './puzzle-fixtures';
import {
  activePuzzle,
  currentPuzzle,
  enterNamedPuzzle,
  enterPuzzles,
  lastPlayer,
  previousPuzzle,
  promotionPiece,
  recalled,
  required,
  SECOND_MS,
  sideOf,
  trackPuzzle,
  uciOf,
  waitSolverToMove,
} from './puzzle-world';

const fenBeforeKey = (actor: Actor) => `fenBeforeMove:${actor}`;
const moveKey = (actor: Actor) => `lastMove:${actor}`;
const solvedClockKey = (actor: Actor) => `clockAtSolve:${actor}`;
const clockKey = (actor: Actor) => `clock:${actor}`;
const LAST_MOVER = 'lastMover';

function lastMover(w: Parameters<typeof trackPuzzle>[0]): Actor {
  return recalled<Actor>(w, LAST_MOVER);
}

async function boardProbe(w: Parameters<typeof trackPuzzle>[0], actor: Actor) {
  return required(
    await w.s.read(readPuzzleBoardProbe, actor),
    `${actor}'s board`
  );
}

/** Move once the solver may, remembering the position the move started from. */
async function playMove(
  w: Parameters<typeof trackPuzzle>[0],
  actor: Actor,
  move: string
): Promise<void> {
  const uci = uciOf(move);
  await waitSolverToMove(w, actor);
  remember(w, fenBeforeKey(actor), (await boardProbe(w, actor)).fen);
  remember(w, moveKey(actor), uci);
  remember(w, LAST_MOVER, actor);
  await w.s.apply(playPuzzleMove, actor, uci);
}

/** Try a move the board should not take; the solver may otherwise move. */
async function tryMove(
  w: Parameters<typeof trackPuzzle>[0],
  actor: Actor,
  move: string
): Promise<void> {
  await playMove(w, actor, move);
}

function outcomesOf(text: string): string[] {
  return text.split(',').map((outcome) => outcome.trim());
}

// ------------------------------------------------------------ on the board

Given('{actor} is playing puzzles in their space', async (w, actor: Actor) => {
  await enterPuzzles(w, actor);
});

When('{actor} opens puzzles in their space', async (w, actor: Actor) => {
  await w.s.apply(openPuzzleFromSpace, actor);
  await trackPuzzle(w, actor);
});

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

When('{actor} solves the puzzle', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(playUntilSolved, actor);
  const probe = await w.s.read(readPuzzleSpectator, actor);
  remember(w, solvedClockKey(actor), probe?.clockMs ?? null);
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
  await w.s.apply(playWrongPuzzleMove, actor);
});

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

Then('{actor} is (still )solving the puzzle', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect(await w.s.read(readPuzzleStatus, actor)).toBe('solving');
});

Then(
  '{actor} is solving the puzzle within {int} seconds',
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

Then('{actor} has no hint showing', async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleHintStage, actor)).toBe('none');
});

When('{actor} asks for a hint', async (w, actor: Actor) => {
  await w.s.apply(requestPuzzleHint, actor);
});

When('{actor} asks for another hint', async (w, actor: Actor) => {
  await w.s.apply(revealPuzzleSolution, actor, 'hint');
});

When('{actor} asks to see the solution move', async (w, actor: Actor) => {
  await w.s.apply(revealPuzzleSolution, actor, 'solution');
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

When('{actor} plays {word}', async (w, actor: Actor, move: string) => {
  await playMove(w, actor, move);
});

When(
  '{actor} plays {word} and promotes to a {word}',
  async (w, actor: Actor, move: string, piece: string) => {
    await playMove(w, actor, move);
    await w.s.apply(choosePuzzlePromotion, actor, promotionPiece(piece));
  }
);

When('{actor} promotes to a {word}', async (w, actor: Actor, piece: string) => {
  await w.s.apply(choosePuzzlePromotion, actor, promotionPiece(piece));
});

When(
  "{actor} tries to move the opponent's piece {word}",
  async (w, actor: Actor, move: string) => {
    await tryMove(w, actor, move);
  }
);

When(
  '{actor} tries the illegal move {word}',
  async (w, actor: Actor, move: string) => {
    await tryMove(w, actor, move);
  }
);

When(
  '{actor} castles by moving the king onto its own rook',
  async (w, actor: Actor) => {
    await waitSolverToMove(w, actor);
    const expected = required(
      await w.s.read(readPuzzleDebug, actor),
      'puzzle debug'
    ).solutionUci;
    // The castle the line expects, entered as king-takes-own-rook.
    const rookFile = expected[2] === 'g' ? 'h' : 'a';
    const uci = `${expected.slice(0, 2)}${rookFile}${expected[3] ?? ''}`;
    await playMove(w, actor, `${uci.slice(0, 2)}-${uci.slice(2, 4)}`);
  }
);

When(
  '{actor} castles by moving the king two squares',
  async (w, actor: Actor) => {
    await waitSolverToMove(w, actor);
    const expected = required(
      await w.s.read(readPuzzleDebug, actor),
      'puzzle debug'
    ).solutionUci;
    await playMove(w, actor, `${expected.slice(0, 2)}-${expected.slice(2, 4)}`);
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
  '{actor} is prompted {string}',
  async (w, actor: Actor, prompt: string) => {
    expect(await w.s.read(readPuzzlePrompt, actor)).toBe(prompt);
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
  await waitSolverToMove(w, actor);
  const replyUci = uciOf(reply);
  // The position the solver's move and then the reply reach.
  const chess = new Chess(recalled<string>(w, fenBeforeKey(actor)));
  const played = recalled<string>(w, moveKey(actor));
  chess.move({ from: played.slice(0, 2), to: played.slice(2, 4) });
  chess.move({ from: replyUci.slice(0, 2), to: replyUci.slice(2, 4) });
  const probe = await boardProbe(w, actor);
  expect(probe.fen.split(' ')[0]).toBe(chess.fen().split(' ')[0]);
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
  expect((await boardProbe(w, actor)).fen).toBe(
    recalled<string>(w, fenBeforeKey(actor))
  );
});

Then(
  '{actor} feels the {word} haptic',
  async (w, actor: Actor, haptic: string) => {
    expect(await w.s.read(readPuzzleHaptics, actor)).toContain(haptic);
  }
);

// ------------------------------------------------------- recorded outcomes

Then(
  "the puzzle's recorded outcomes are (still ){string}",
  async (w, outcomes: string) => {
    const actor = lastPlayer(w);
    expect(
      await w.s.read(readPuzzleOutcomes, actor, currentPuzzle(w, actor))
    ).toEqual(outcomesOf(outcomes));
  }
);

Then('the puzzle has no recorded outcome', async (w) => {
  const actor = lastPlayer(w);
  expect(
    await w.s.read(readPuzzleOutcomes, actor, currentPuzzle(w, actor))
  ).toEqual([]);
});

Then('the only thing recorded for the puzzle is that it started', async (w) => {
  const actor = lastPlayer(w);
  expect(
    await w.s.read(readPuzzleInteractions, actor, currentPuzzle(w, actor))
  ).toEqual([{ kind: 'started', uci: null, correct: null }]);
});

Then('the puzzle has been started once', async (w) => {
  const actor = lastPlayer(w);
  expect(
    await w.s.read(countPuzzleStarts, actor, currentPuzzle(w, actor))
  ).toBe(1);
});

// ------------------------------------------------------ skipping and clock

When('{actor} skips the puzzle', async (w, actor: Actor) => {
  await w.s.apply(skipPuzzle, actor);
});

Then("{actor}'s puzzle is skipped", async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleStatus, actor)).toBe('skipped');
  expect(await w.s.read(readPuzzleStatusKind, actor)).toBe('skipped');
});

Then("{actor}'s puzzle is not skipped", async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleStatusKind, actor)).not.toBe('skipped');
});

Then("{actor}'s puzzle has started", async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleStatusKind, actor)).toBe('started');
});

When('{int} seconds pass', async (w, seconds: number) => {
  await w.s.advanceTime(seconds * SECOND_MS);
});

async function readClock(
  w: Parameters<typeof trackPuzzle>[0],
  actor: Actor
): Promise<number> {
  const probe = await w.s.read(readPuzzleSpectator, actor);
  return required(probe?.clockMs, `${actor}'s puzzle clock`);
}

Then(
  "{actor}'s puzzle clock shows at least {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    const clock = await readClock(w, actor);
    expect(clock).toBeGreaterThanOrEqual(seconds * SECOND_MS);
    remember(w, clockKey(actor), clock);
  }
);

Then("{actor}'s puzzle clock has moved on", async (w, actor: Actor) => {
  const clock = await readClock(w, actor);
  expect(clock).toBeGreaterThan(recalled<number>(w, clockKey(actor)));
  remember(w, clockKey(actor), clock);
});

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

When('{actor} moves on to the next puzzle', async (w, actor: Actor) => {
  await w.s.apply(pressPuzzleNext, actor);
  await trackPuzzle(w, actor);
});

When(
  '{actor} moves on to the next puzzle without waiting for it',
  async (w, actor: Actor) => {
    await w.s.apply(pressPuzzleNextNoWait, actor);
  }
);

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
  expect(await w.s.read(readActivePuzzleId, actor)).toBe(
    currentPuzzle(w, actor)
  );
});

Then('{actor} is still on the same puzzle', async (w, actor: Actor) => {
  expect(await w.s.read(readActivePuzzleId, actor)).toBe(
    currentPuzzle(w, actor)
  );
});

Then(
  "{actor}'s next puzzle is already chosen and differs from the current one",
  async (w, actor: Actor) => {
    const next = required(
      await w.s.read(readNextPuzzleId, actor),
      'a chosen next puzzle'
    );
    expect(next).not.toBe(currentPuzzle(w, actor));
  }
);

When(
  '{actor} sets puzzles to advance {int} second(s) after a solve',
  async (w, actor: Actor, seconds: number) => {
    if (seconds !== 1) {
      throw new Error(`auto-advance offers 1 second, not ${String(seconds)}`);
    }
    await w.s.apply(setPuzzleAutoAdvance, actor, 'after1s');
  }
);

// ------------------------------------------------ leaving and coming back

When(
  '{actor} leaves the puzzle for the chess choices',
  async (w, actor: Actor) => {
    await w.s.apply(leavePuzzleToChessMenu, actor);
  }
);

When('{actor} goes back to the puzzles', async (w, actor: Actor) => {
  await w.s.apply(returnToPuzzleScreen, actor);
});

When('{actor} returns to their space', async (w, actor: Actor) => {
  await w.s.apply(reenterActiveSpace, actor, actor);
});

// ------------------------------------------------------------------ account

Then('{actor} (still )has no account', async (w, actor: Actor) => {
  expect(await w.s.read(accountIdOf, actor)).toBeNull();
});
