/**
 * `specs/games/puzzle-attempt.qnt` against a space where a guest plays the
 * trace's game's puzzles while another guest watches. The pool is the
 * game's three known puzzles, each with two solver moves; every move is
 * the known puzzle's (a wrong move where its author wrote none is one the
 * game's rules allow there that neither follows the line nor wins). The
 * model's state is read back off both people's views. Puzzle ids are
 * opaque, so each is numbered in the order it first reached the host's
 * board.
 */

import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  playNextKnownMove,
  playWrongMoveHere,
  solveKnownPuzzle,
  suggestMoveToHost,
} from '@libs/game-session-harness-ts/puzzle-moves';
import { attemptHostPuzzleCommand } from '@libs/game-session-harness-ts/puzzle-room-probe';
import {
  askForNextPuzzleTwice,
  choosePuzzleLineMove,
  goBackToGamePuzzles,
  leavePuzzleForGameChoices,
  moveOnToNextPuzzle,
  openGamePuzzles,
  readPuzzleControls,
  readPuzzleOnBoard,
  readPuzzleProbe,
  readPuzzleStartsLeft,
  readPuzzleView,
  retryGamePuzzle,
  retryGamePuzzleIfOffered,
  showPuzzleSolution,
  skipGamePuzzle,
  stepThroughPuzzleLine,
  takePuzzleHint,
  takeSecondPuzzleHint,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { attemptGoBackToGameChoice } from '@libs/game-session-harness-ts/space-game-choice';
import {
  partition,
  restartApp,
  restoreNetwork,
} from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { focusActor } from '@libs/harness-ts/shell-actions';
import {
  createSpace,
  joinFromPrompt,
  openSpaceLink,
  returnToOwnSpace,
} from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import { variant } from '@pkgs/quint-shared-ts/itf';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import { turnConformanceGameOf } from '../conformance-world';
import doubleNextTrace from './fixtures/puzzle-exhausted-double-next.itf.json';
import returnTrace from './fixtures/puzzle-exhausted-return.itf.json';

const HOST = 'alice';
const WATCHER = 'bob';
const PEOPLE = [HOST, WATCHER] as const;
/** The model's daily puzzle limit of a guest. */
const GUEST_DAILY_STARTS = 20;
/** Longer than the minute the clock's own examples need. */
const TIME_PASSING_MS = 65_000;
/** Memo key: puzzle ids in the order they first reached the host's board. */
const SEEN = 'seenPuzzles';

/** The game this trace is replayed for: one offering puzzles. */
function gameOfTrace(w: QuintHarnessWorld): TurnHarnessGame {
  return turnConformanceGameOf(w.ctx.variant, w.ctx.title);
}

function gameId(w: QuintHarnessWorld): string {
  return gameOfTrace(w).shared.id;
}

function seen(w: QuintHarnessWorld): readonly string[] {
  const ids = w.memo.get(SEEN);
  return Array.isArray(ids) ? (ids as string[]) : [];
}

/** Number the puzzle now on the host's board, if it is new. */
async function notePuzzle(w: QuintHarnessWorld): Promise<void> {
  const id = await w.s.read(readPuzzleOnBoard, HOST);
  if (id === null) throw new Error(`${HOST} has no puzzle on the board`);
  const ids = seen(w);
  if (!ids.includes(id)) w.memo.set(SEEN, [...ids, id]);
}

/** A puzzle never noted numbers as -2: the model never shows one. */
function numberOf(w: QuintHarnessWorld, id: string | null): number {
  if (id === null) return -1;
  const n = seen(w).indexOf(id);
  return n === -1 ? -2 : n;
}

/** The host drives: bring her view to the front, then act on it. */
function hostDoes(
  act: (w: QuintHarnessWorld) => Promise<void>,
  landsOnBoard = false
): (w: QuintHarnessWorld) => Promise<void> {
  return async (w) => {
    await w.s.apply(focusActor, HOST);
    await act(w);
    if (landsOnBoard) await notePuzzle(w);
  };
}

/** Puzzle starts used today: the daily limit less what the board says is left. */
async function startsUsed(
  w: QuintHarnessWorld,
  actor: string,
  onBoard: boolean
): Promise<number> {
  const left = onBoard ? await w.quiet.read(readPuzzleStartsLeft, actor) : null;
  const starts =
    left === null
      ? Number(w.memo.get(`puzzleStarts:${actor}`) ?? 0)
      : GUEST_DAILY_STARTS - left;
  w.memo.set(`puzzleStarts:${actor}`, starts);
  return starts;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'puzzle-attempt',
  traces: 64,
  maxSteps: 64,
  verifySteps: 8,
  // Two views read after every step.
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: exhausted-puzzle-same-instant-order
      id: 'exhausted-puzzle-same-instant-order',
      title: 'Moving on after pool exhaustion keeps causal play order',
      seed: '0x67932',
      parameters: { OPPONENT: false },
      itf: doubleNextTrace,
    },
    {
      // regression: exhausted-puzzle-return-order
      id: 'exhausted-puzzle-return-order',
      title: 'Returning after a repeated puzzle serves the oldest other play',
      seed: '0x67932',
      parameters: { OPPONENT: false },
      itf: returnTrace,
    },
  ],
  actions: {
    init: async (w) => {
      await w.s.apply(focusActor, HOST);
      await w.s.apply(createSpace, HOST);
      const link = await w.s.read(readSpaceLink, HOST);
      if (link === null) throw new Error(`${HOST} opened no space`);
      await w.s.apply(openSpaceLink, WATCHER, link);
      await w.s.apply(joinFromPrompt, WATCHER);
    },
    openPuzzles: hostDoes(
      (w) => w.s.apply(openGamePuzzles, HOST, gameId(w)),
      true
    ),
    goBackToPuzzles: hostDoes(
      (w) => w.s.apply(goBackToGamePuzzles, HOST),
      true
    ),
    leavePuzzle: hostDoes((w) => w.s.apply(leavePuzzleForGameChoices, HOST)),
    backToGameChoice: hostDoes((w) =>
      w.s.apply(attemptGoBackToGameChoice, HOST, gameId(w))
    ),
    solve: hostDoes((w) => w.s.apply(solveKnownPuzzle, HOST, gameId(w))),
    playWrongMove: hostDoes((w) =>
      w.s.apply(playWrongMoveHere, HOST, gameId(w))
    ),
    playCorrectContinuation: hostDoes((w) =>
      w.s.apply(playNextKnownMove, HOST, gameId(w))
    ),
    requestHint: hostDoes((w) => w.s.apply(takePuzzleHint, HOST)),
    revealSolutionMove: hostDoes((w) => w.s.apply(takeSecondPuzzleHint, HOST)),
    stepBackPosition: hostDoes((w) =>
      w.s.apply(stepThroughPuzzleLine, HOST, 'back')
    ),
    stepForwardPosition: hostDoes((w) =>
      w.s.apply(stepThroughPuzzleLine, HOST, 'forward')
    ),
    showSolution: hostDoes((w) => w.s.apply(showPuzzleSolution, HOST)),
    skip: hostDoes((w) => w.s.apply(skipGamePuzzle, HOST)),
    retry: hostDoes((w) => w.s.apply(retryGamePuzzle, HOST)),
    moveOn: hostDoes((w) => w.s.apply(moveOnToNextPuzzle, HOST), true),
    moveOnTwiceAtOnce: hostDoes(
      (w) => w.s.apply(askForNextPuzzleTwice, HOST),
      true
    ),
    tryMoveAfterFinish: hostDoes((w) =>
      w.s.apply(attemptHostPuzzleCommand, HOST, HOST, 'move')
    ),
    tryHintAfterFinish: hostDoes((w) =>
      w.s.apply(attemptHostPuzzleCommand, HOST, HOST, 'hint')
    ),
    tryShowSolutionAfterFinish: hostDoes((w) =>
      w.s.apply(attemptHostPuzzleCommand, HOST, HOST, 'show-line')
    ),
    trySkipAfterFinish: hostDoes((w) =>
      w.s.apply(attemptHostPuzzleCommand, HOST, HOST, 'skip')
    ),
    tryMoveFromReview: hostDoes((w) =>
      w.s.apply(attemptHostPuzzleCommand, HOST, HOST, 'move')
    ),
    tryHintFromReview: hostDoes((w) =>
      w.s.apply(attemptHostPuzzleCommand, HOST, HOST, 'hint')
    ),
    tryShowSolutionFromReview: hostDoes((w) =>
      w.s.apply(attemptHostPuzzleCommand, HOST, HOST, 'show-line')
    ),
    tryHintBeforeRetry: hostDoes((w) =>
      w.s.apply(attemptHostPuzzleCommand, HOST, HOST, 'hint')
    ),
    tryMoveBeforeRetry: hostDoes((w) =>
      w.s.apply(attemptHostPuzzleCommand, HOST, HOST, 'move')
    ),
    tryRetryWhileSolving: hostDoes((w) =>
      w.s.apply(retryGamePuzzleIfOffered, HOST)
    ),
    trySolutionBeforeHint: hostDoes((w) =>
      w.s.apply(attemptHostPuzzleCommand, HOST, HOST, 'solution')
    ),
    tryIllegalMove: hostDoes((w) =>
      w.s.apply(attemptHostPuzzleCommand, HOST, HOST, 'illegal')
    ),
    tryEarlierHint: hostDoes((w) =>
      w.s.apply(attemptHostPuzzleCommand, HOST, HOST, 'hint')
    ),
    tryReviewBeforeRetry: hostDoes((w) =>
      w.s.apply(attemptHostPuzzleCommand, HOST, HOST, 'step')
    ),
    suggestMove: async (w) => {
      await w.s.apply(focusActor, WATCHER);
      await w.s.apply(suggestMoveToHost, WATCHER, gameId(w));
    },
    chooseReviewPosition: async (w, picks) => {
      await w.s.apply(focusActor, HOST);
      await w.s.apply(choosePuzzleLineMove, HOST, Number(picks['move']));
    },
    timePasses: (w) => w.s.advanceTime(TIME_PASSING_MS),
    reopenApp: hostDoes(async (w) => {
      await w.s.apply(restartApp, HOST);
      await w.s.apply(returnToOwnSpace, HOST);
    }),
    _loseConnection: async (w, picks) => {
      await w.s.apply(partition, String(picks['person']));
    },
    connectionReturns: async (w) => {
      await w.s.apply(restoreNetwork);
    },
  },
  observe: async (w) => {
    const view = new Map<QuintValue, QuintValue>();
    const puzzleState = new Map<QuintValue, QuintValue>();
    const moveOnOffered = new Map<QuintValue, QuintValue>();
    const puzzle = new Map<QuintValue, QuintValue>();
    const puzzleStarts = new Map<QuintValue, QuintValue>();
    let position = 0;
    let help = 'none';
    for (const actor of PEOPLE) {
      const shown = await w.quiet.read(readPuzzleView, actor, gameId(w));
      const onBoard = shown === 'Board';
      const probe = onBoard ? await w.quiet.read(readPuzzleProbe, actor) : null;
      view.set(actor, variant(shown));
      puzzleState.set(actor, onBoard ? (probe?.status ?? 'unknown') : 'none');
      moveOnOffered.set(
        actor,
        (await w.quiet.read(readPuzzleControls, actor)).moveOnOffered
      );
      puzzle.set(
        actor,
        numberOf(
          w,
          onBoard ? await w.quiet.read(readPuzzleOnBoard, actor) : null
        )
      );
      puzzleStarts.set(actor, await startsUsed(w, actor, onBoard));
      if (actor === HOST && onBoard) {
        position = probe?.solveIdx ?? 0;
        help = probe?.hintStage ?? 'none';
      }
    }
    return {
      view,
      puzzleState,
      moveOnOffered,
      puzzle,
      puzzleStarts,
      position,
      help,
    };
  },
});
