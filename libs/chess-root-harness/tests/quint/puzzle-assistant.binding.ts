/**
 * `specs/chess/puzzle-assistant.qnt` against the chess composition: a guest
 * hosting a space plays chess puzzles through the chess harness actions
 * while another guest in the space watches, and the model's state — the
 * attempt and the Puzzle Assistant following it — is read back off both
 * views. Puzzle ids are opaque, so each is numbered in the order it first
 * reached the host's board.
 */

import {
  playNextSolutionMove,
  playUntilSolved,
  playWrongPuzzleMove,
  suggestNonSolutionMove,
} from '@libs/chess-puzzle-harness/chess-actions';
import {
  chooseMovablePuzzlePiece,
  mutePuzzleAssistant,
  readPuzzleAssistant,
  unmutePuzzleAssistant,
} from '@libs/chess-puzzle-harness/puzzle-assistant-ui';
import {
  readPuzzleGuidance,
  readPuzzleView,
} from '@libs/chess-puzzle-harness/puzzle-control-reads';
import { preparePuzzleModelPool } from '@libs/chess-puzzle-harness/puzzle-model-pool';
import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
import { attemptHostPuzzleCommand } from '@libs/game-session-harness/puzzle-room-probe';
import {
  askForNextPuzzleTwice,
  choosePuzzleLineMove,
  goBackToGamePuzzles,
  leavePuzzleForGameChoices,
  moveOnToNextPuzzle,
  openGamePuzzles,
  readPuzzleControls,
  readPuzzleOnBoard,
  readPuzzleStartsLeft,
  readPuzzleState,
  retryGamePuzzle,
  retryGamePuzzleIfOffered,
  showPuzzleSolution,
  skipGamePuzzle,
  stepThroughPuzzleLine,
  takePuzzleHint,
  takeSecondPuzzleHint,
} from '@libs/game-session-harness/puzzle-screen';
import { attemptGoBackToGameChoice } from '@libs/game-session-harness/space-game-choice';
import { partition, restartApp, restoreNetwork } from '@libs/harness/actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { focusActor } from '@libs/harness/shell-actions';
import {
  createSpace,
  joinFromPrompt,
  openSpaceLink,
  returnToOwnSpace,
} from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { variant } from '@pkgs/quint-shared/itf';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import offlineNavigationTrace from './fixtures/puzzle-offline-navigation.itf.json';
import offlineReopenTrace from './fixtures/puzzle-offline-reopen-keeps-view.itf.json';
import reopenResult from './fixtures/puzzle-reopen-keeps-result.itf.json';
import reviewSolutionTrace from './fixtures/puzzle-review-solution.itf.json';
import skippedReconnectTrace from './fixtures/puzzle-skipped-reconnect.itf.json';
import hintedSolutionTrace from './fixtures/puzzle-solution-after-hint.itf.json';
import gameChoiceTrace from './fixtures/puzzle-watcher-game-choice.itf.json';
import reconnectTrace from './fixtures/puzzle-watcher-reconnect.itf.json';

const HOST = 'alice';
const WATCHER = 'bob';
const PEOPLE = [HOST, WATCHER] as const;
/** Memo key: puzzle ids in the order they first reached the host's board. */
const SEEN = 'seenPuzzles';

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

async function startsUsed(
  w: QuintHarnessWorld,
  actor: string,
  onBoard: boolean
) {
  const remaining = onBoard
    ? await w.quiet.read(readPuzzleStartsLeft, actor)
    : null;
  const starts =
    remaining === null
      ? Number(w.memo.get(`puzzleStarts:${actor}`) ?? 0)
      : 20 - remaining;
  w.memo.set(`puzzleStarts:${actor}`, starts);
  return starts;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'puzzle-assistant',
  traces: 64,
  maxSteps: 64,
  verifySteps: 8,
  // Two views read after every step: a trace runs ~10s alone, but several
  // times that beside the rest of the package's suite.
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: puzzle-offline-reopen-keeps-view
      id: 'puzzle-offline-reopen-keeps-view',
      title: 'Reopening offline keeps the host puzzle view',
      seed: '0x67932',
      itf: offlineReopenTrace,
    },
    {
      // regression: puzzle-reopen-keeps-result
      id: 'puzzle-reopen-keeps-result',
      title: 'Reopening keeps a finished attempt until the solver moves on',
      seed: '0x67932',
      itf: reopenResult,
    },
    // regression: puzzle-reconnect-allowance-disappears
    // regression: puzzle-skipped-reconnect
    {
      id: 'puzzle-skipped-reconnect',
      title: 'A returning watcher sees the skipped puzzle and commentary',
      seed: '0x67932',
      itf: skippedReconnectTrace,
    },
    // regression: puzzle-history-solution-accepted
    {
      id: 'puzzle-review-solution',
      title: 'Reviewing an earlier position cannot start showing the solution',
      seed: '0x67932',
      itf: reviewSolutionTrace,
    },
    // regression: quint-convergence-resampled
    {
      id: 'puzzle-watcher-reconnect',
      title: 'A returning watcher reaches the latest chess choices',
      seed: '0x67932',
      itf: reconnectTrace,
    },
    // regression: puzzle-solution-after-hint-overclick
    {
      id: 'puzzle-solution-after-hint',
      title: 'A hinted solution needs only the remaining presses',
      seed: '0x67932',
      itf: hintedSolutionTrace,
    },
    // regression: quint-convergence-resampled
    {
      id: 'puzzle-watcher-game-choice',
      title: 'A returning watcher reaches the latest game choice',
      seed: '0x67932',
      itf: gameChoiceTrace,
    },
    // regression: quint-convergence-resampled
    {
      id: 'puzzle-offline-navigation',
      title: 'Offline navigation survives reconnect',
      seed: '0x67932',
      itf: offlineNavigationTrace,
    },
  ],
  actions: {
    init: async (w) => {
      await w.s.apply(preparePuzzleModelPool);
      await w.s.apply(focusActor, HOST);
      await w.s.apply(createSpace, HOST);
      const link = await w.s.read(readSpaceLink, HOST);
      if (link === null) throw new Error(`${HOST} opened no space`);
      await w.s.apply(openSpaceLink, WATCHER, link);
      await w.s.apply(joinFromPrompt, WATCHER);
    },
    openPuzzles: hostDoes(
      (w) => w.s.apply(openGamePuzzles, HOST, CHESS_GAME_ID),
      true
    ),
    goBackToPuzzles: hostDoes(
      (w) => w.s.apply(goBackToGamePuzzles, HOST),
      true
    ),
    leavePuzzle: hostDoes((w) => w.s.apply(leavePuzzleForGameChoices, HOST)),
    backToGameChoice: hostDoes((w) =>
      w.s.apply(attemptGoBackToGameChoice, HOST, CHESS_GAME_ID)
    ),
    solve: hostDoes((w) => w.s.apply(playUntilSolved, HOST)),
    playWrongMove: hostDoes((w) => w.s.apply(playWrongPuzzleMove, HOST)),
    playCorrectContinuation: hostDoes((w) =>
      w.s.apply(playNextSolutionMove, HOST)
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
      await w.s.apply(suggestNonSolutionMove, WATCHER);
    },
    chooseReviewPosition: async (w, picks) => {
      await w.s.apply(focusActor, HOST);
      await w.s.apply(choosePuzzleLineMove, HOST, Number(picks['move']));
    },
    choosePiece: hostDoes((w) => w.s.apply(chooseMovablePuzzlePiece, HOST)),
    timePasses: (w) => w.s.advanceTime(65_000),
    reopenApp: hostDoes(async (w) => {
      await w.s.apply(restartApp, HOST);
      await w.s.apply(returnToOwnSpace, HOST);
    }),
    muteAssistant: async (w, picks) => {
      const actor = String(picks['person']);
      await w.s.apply(focusActor, actor);
      await w.s.apply(mutePuzzleAssistant, actor);
    },
    unmuteAssistant: async (w, picks) => {
      const actor = String(picks['person']);
      await w.s.apply(focusActor, actor);
      await w.s.apply(unmutePuzzleAssistant, actor);
    },
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
    const commentary = new Map<QuintValue, QuintValue>();
    const commentaryPuzzle = new Map<QuintValue, QuintValue>();
    const assistantMuted = new Map<QuintValue, QuintValue>();
    for (const actor of PEOPLE) {
      const shown = await w.quiet.read(readPuzzleView, actor);
      const onBoard = shown === 'Board';
      const assistant = onBoard
        ? await w.quiet.read(readPuzzleAssistant, actor)
        : null;
      commentary.set(
        actor,
        onBoard ? (assistant?.purpose ?? 'unknown') : 'none'
      );
      commentaryPuzzle.set(
        actor,
        numberOf(w, onBoard ? (assistant?.puzzleId ?? null) : null)
      );
      const lastMuted = w.memo.get(`assistantMuted:${actor}`) ?? false;
      const muted = assistant?.muted ?? lastMuted;
      w.memo.set(`assistantMuted:${actor}`, muted);
      assistantMuted.set(actor, muted as boolean);
      view.set(actor, variant(shown));
      puzzleState.set(
        actor,
        onBoard
          ? ((await w.quiet.read(readPuzzleState, actor)) ?? 'unknown')
          : 'none'
      );
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
    }
    return {
      ...(await w.quiet.read(readPuzzleGuidance, HOST)),
      view,
      puzzleState,
      moveOnOffered,
      puzzle,
      puzzleStarts,
      commentary,
      commentaryPuzzle,
      assistantMuted,
    };
  },
});
