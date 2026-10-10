import type { ChessPuzzleTheme } from '@libs/chess-puzzle-shared/chess-puzzle-themes';
import { pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import type {
  FeedAutoAdvance,
  FeedHistoryFilter,
  FeedMode,
} from './chess-puzzle-feed-ui';
import {
  closeFeedSettings,
  decreaseFeedCustomRating,
  decreaseFeedOffset,
  increaseFeedCustomRating,
  increaseFeedOffset,
  openFeedSettings,
  selectFeedAutoAdvance,
  selectFeedHistory,
  selectFeedMode,
  selectFeedTheme,
} from './chess-puzzle-feed-ui';
import { readMsUntilNextUtcDay } from './chess-puzzle-ledger-data';
import type { PuzzleNavControl } from './chess-puzzle-review-ui';
import {
  pressPuzzleNavControl,
  pressPuzzleReviewKey,
  swipePuzzleReviewBoard,
  tapPuzzleReviewPly,
} from './chess-puzzle-review-ui';
import {
  dragPuzzleUci,
  pickPuzzlePromotion,
  pickUpPuzzlePieceAt,
  readPuzzleBoardProbe,
  showPuzzleSolution,
  tapPuzzleUci,
} from './chess-puzzle-solve-ui';
import {
  suggestPuzzleMove as dragSuggestedMove,
  expectPlayReady,
  isEmptyPoolVisible,
  isPuzzleSummaryNextVisible,
  leaveChessStats,
  openChessStats,
  openPuzzleFromChessMenu,
  openPuzzlePlay,
  openPuzzlePlayNoWait,
  openReviewFromGameLog,
  pickWrongUci,
  playWrongMove,
  pressChessMenuBackToGameMenu,
  pressPuzzleBackToChessMenu,
  pressPuzzleHint,
  pressPuzzleRetry,
  readActivePuzzleId,
  readPuzzleDebug,
  readPuzzleDisplayFen,
  returnToPuzzles,
  settleAfterPuzzleNext,
  showChessStats,
  solvePuzzle,
  tapEmptyPoolPrimaryAction,
  pressPuzzleNext as tapPuzzleNext,
  pressPuzzleNextIfVisible as tapPuzzleNextIfVisible,
  skipPuzzle as tapPuzzleSkip,
  pressPuzzleSummaryNext as tapPuzzleSummaryNext,
  waitPuzzleHintStage,
} from './chess-puzzle-ui';
import {
  listenToTheApp,
  playPuzzleMoveWithKeyboard,
  usePuzzleControlWithKeyboard,
} from './puzzle-keyboard';

export const openPuzzleFromSpace = scenarioAction({
  name: 'openPuzzleFromSpace',
  act: openPuzzlePlay,
});

/** Open the puzzle screen without waiting for a board (the feed may be empty). */
export const openPuzzleFromSpaceNoWait = scenarioAction({
  name: 'openPuzzleFromSpaceNoWait',
  act: openPuzzlePlayNoWait,
});

/** Back on the board from the chess main menu (a pending attempt is restored). */
export const reopenPuzzleFromChessMenu = scenarioAction({
  name: 'reopenPuzzleFromChessMenu',
  act: openPuzzleFromChessMenu,
});

/** Back to the puzzle screen from the chess choices or an interruption. */
export const returnToPuzzleScreen = scenarioAction({
  name: 'returnToPuzzleScreen',
  act: returnToPuzzles,
});

export const playUntilSolved = scenarioAction({
  name: 'playUntilSolved',
  act: solvePuzzle,
});

/**
 * Presses Next and waits until a different puzzle is active (or loading
 * finishes). The standing `nextPuzzleDifferent` property asserts the id
 * actually changed.
 */
export const pressPuzzleNext = scenarioAction({
  name: 'pressPuzzleNext',
  act: async (s, actorId: string) => {
    await tapPuzzleNext(s, actorId);
    await settleAfterPuzzleNext(s, actorId);
  },
});

/** Presses Next when the feed may be exhausted (does not wait for a puzzle). */
export const pressPuzzleNextNoWait = scenarioAction({
  name: 'pressPuzzleNextNoWait',
  act: tapPuzzleNext,
});

/**
 * Tap the action bar's Next only when it is already on screen. Waiting would
 * be the wrong ask while a puzzle is still being solved and Next is absent.
 */
export const pressPuzzleNextIfVisible = scenarioAction({
  name: 'pressPuzzleNextIfVisible',
  act: tapPuzzleNextIfVisible,
});

/** Drag a legal move that is not the solution; the attempt turns `wrong`. */
export const playWrongPuzzleMove = scenarioAction({
  name: 'playWrongPuzzleMove',
  act: playWrongMove,
});

/** Drag one UCI move on the puzzle board (solver input, §3). */
export const playPuzzleMove = scenarioAction({
  name: 'playPuzzleMove',
  act: (s, actorId: string, uci: string) => dragPuzzleUci(s, actorId, uci),
});

/** Tap-tap the same move (the no-drag input path, §3). */
export const tapPuzzleMove = scenarioAction({
  name: 'tapPuzzleMove',
  act: (s, actorId: string, uci: string) => tapPuzzleUci(s, actorId, uci),
});

/** Pick up the piece on a square to see where it can go (§3). */
export const pickUpPuzzlePiece = scenarioAction({
  name: 'pickUpPuzzlePiece',
  act: (s, actorId: string, square: Square) =>
    pickUpPuzzlePieceAt(s, actorId, square),
});

/** Choose a piece in the promotion picker (never auto-queen, §3). */
export const choosePuzzlePromotion = scenarioAction({
  name: 'choosePuzzlePromotion',
  act: (s, actorId: string, piece: 'q' | 'r' | 'b' | 'n') =>
    pickPuzzlePromotion(s, actorId, piece),
});

/** §6 Show solution: the rest of the line plays out, then review. */
export const showPuzzleSolutionLine = scenarioAction({
  name: 'showPuzzleSolutionLine',
  act: showPuzzleSolution,
});

/**
 * "Next puzzle" pressed twice back to back (§34 fast double input): the
 * result panel's CTA when it shows (after a solve), else the action bar's
 * button, then the action bar's button again. The second press is
 * best-effort — by then the chrome may already be gone.
 */
export const pressPuzzleNextTwice = scenarioAction({
  name: 'pressPuzzleNextTwice',
  act: async (s, actorId: string) => {
    const first = (await isPuzzleSummaryNextVisible(s, actorId))
      ? tapPuzzleSummaryNext
      : tapPuzzleNext;
    await first(s, actorId);
    await tapPuzzleNextIfVisible(s, actorId);
    await settleAfterPuzzleNext(s, actorId);
  },
});

/** Set the §5 auto-advance preference through the feed settings modal. */
export const setPuzzleAutoAdvance = scenarioAction({
  name: 'setPuzzleAutoAdvance',
  act: async (s, actorId: string, setting: FeedAutoAdvance) => {
    await openFeedSettings(s, actorId);
    await selectFeedAutoAdvance(s, actorId, setting);
    await closeFeedSettings(s, actorId);
  },
});

export const retryPuzzle = scenarioAction({
  name: 'retryPuzzle',
  act: pressPuzzleRetry,
});

/** Skip abandons the live attempt without solving it (terminal `skipped`). */
export const skipPuzzle = scenarioAction({
  name: 'skipPuzzle',
  act: tapPuzzleSkip,
});

/** A spectator drags a legal move; the room records it as a suggestion. */
export const suggestPuzzleMove = scenarioAction({
  name: 'suggestPuzzleMove',
  act: dragSuggestedMove,
});

/** First Hint press: highlight the piece to move. */
export const requestPuzzleHint = scenarioAction({
  name: 'requestPuzzleHint',
  act: async (s, actorId: string) => {
    await pressPuzzleHint(s, actorId);
    await waitPuzzleHintStage(s, actorId, 'highlight');
  },
});

/** A second hint reveals the solution arrow. */
export const revealPuzzleSolution = scenarioAction({
  name: 'revealPuzzleSolution',
  act: async (s, actorId: string) => {
    await pressPuzzleHint(s, actorId);
    await waitPuzzleHintStage(s, actorId, 'solution');
  },
});

/** Chrome back arrow from play → chess main menu (forfeits an open attempt). */
export const leavePuzzleToChessMenu = scenarioAction({
  name: 'leavePuzzleToChessMenu',
  act: pressPuzzleBackToChessMenu,
});

/** Chrome back arrow from the chess choices → the space's game menu. */
export const leaveChessMenuToGameMenu = scenarioAction({
  name: 'leaveChessMenuToGameMenu',
  act: pressChessMenuBackToGameMenu,
});

export const openChessStatsScreen = scenarioAction({
  name: 'openChessStatsScreen',
  act: openChessStats,
});

/** The stats screen from wherever the device is (see {@link showChessStats}). */
export const showChessStatsScreen = scenarioAction({
  name: 'showChessStatsScreen',
  act: showChessStats,
});

/** Back out of the stats screen to the chess main menu. */
export const leaveChessStatsScreen = scenarioAction({
  name: 'leaveChessStatsScreen',
  act: leaveChessStats,
});

export const openPuzzleReview = scenarioAction({
  name: 'openPuzzleReview',
  act: openReviewFromGameLog,
});

/** §7 scrub control: jump to start / step back / step forward / jump to end. */
export const pressPuzzleReviewNav = scenarioAction({
  name: 'pressPuzzleReviewNav',
  act: (s, actorId: string, control: PuzzleNavControl) =>
    pressPuzzleNavControl(s, actorId, control),
});

/** §7 tappable move list: jump straight to one ply. */
export const tapPuzzleReviewMove = scenarioAction({
  name: 'tapPuzzleReviewMove',
  act: (s, actorId: string, plyIndex: number) =>
    tapPuzzleReviewPly(s, actorId, plyIndex),
});

/** §7 keyboard scrubbing: arrows step, Home / End jump. */
export const pressPuzzleReviewArrow = scenarioAction({
  name: 'pressPuzzleReviewArrow',
  act: (s, actorId: string, key: 'arrowLeft' | 'arrowRight' | 'home' | 'end') =>
    pressPuzzleReviewKey(s, actorId, key),
});

/** §7 swipe scrubbing across the review board. */
export const swipePuzzleReview = scenarioAction({
  name: 'swipePuzzleReview',
  act: (s, actorId: string, direction: 'back' | 'forward') =>
    swipePuzzleReviewBoard(s, actorId, direction),
});

/** Exhausted-feed block primary action, then wait for a placed puzzle. */
export const includePlayedPuzzles = scenarioAction({
  name: 'includePlayedPuzzles',
  act: async (s, actorId: string) => {
    await tapEmptyPoolPrimaryAction(s, actorId);
    await settleAfterPuzzleNext(s, actorId);
  },
});

export const openPuzzleFeedSettings = scenarioAction({
  name: 'openPuzzleFeedSettings',
  act: openFeedSettings,
});

/** Done closes the modal; a changed config re-picks the active puzzle. */
export const closePuzzleFeedSettings = scenarioAction({
  name: 'closePuzzleFeedSettings',
  act: async (s, actorId: string) => {
    await closeFeedSettings(s, actorId);
    await expectPlayReady(s, actorId);
  },
});

/** Done without waiting for a board — the new filter may match nothing. */
export const closePuzzleFeedSettingsNoWait = scenarioAction({
  name: 'closePuzzleFeedSettingsNoWait',
  act: closeFeedSettings,
});

export const setPuzzleFeedHistory = scenarioAction({
  name: 'setPuzzleFeedHistory',
  act: async (s, actorId: string, filter: FeedHistoryFilter) => {
    await selectFeedHistory(s, actorId, filter);
  },
});

export const setPuzzleFeedMode = scenarioAction({
  name: 'setPuzzleFeedMode',
  act: async (s, actorId: string, mode: FeedMode) => {
    await selectFeedMode(s, actorId, mode);
  },
});
export const setPuzzleFeedTheme = scenarioAction({
  name: 'setPuzzleFeedTheme',
  act: async (
    s,
    actorId: string,
    theme: Parameters<typeof selectFeedTheme>[2]
  ) => {
    await selectFeedTheme(s, actorId, theme);
  },
});

export const bumpPuzzleFeedOffset = scenarioAction({
  name: 'bumpPuzzleFeedOffset',
  act: async (s, actorId: string, steps: number) => {
    await increaseFeedOffset(s, actorId, steps);
  },
});

export const bumpPuzzleFeedCustomRating = scenarioAction({
  name: 'bumpPuzzleFeedCustomRating',
  act: async (s, actorId: string, steps: number) => {
    await increaseFeedCustomRating(s, actorId, steps);
  },
});

export const lowerPuzzleFeedOffset = scenarioAction({
  name: 'lowerPuzzleFeedOffset',
  act: decreaseFeedOffset,
});

export const lowerPuzzleFeedCustomRating = scenarioAction({
  name: 'lowerPuzzleFeedCustomRating',
  act: decreaseFeedCustomRating,
});

/**
 * Done saves the feed settings; wait for what the feed comes to — a playable
 * puzzle, or the empty-feed notice when the saved choices fit no puzzle.
 */
export const savePuzzleFeedSettings = scenarioAction({
  name: 'savePuzzleFeedSettings',
  act: async (s, actorId: string) => {
    await closeFeedSettings(s, actorId);
    await pollUntil(
      s,
      async () =>
        (await isEmptyPoolVisible(s, actorId)) ||
        (await readActivePuzzleId(s, actorId)) !== null
          ? true
          : null,
      { maxMs: SETTLE_MS, stepMs: POLL_MS, description: 'feed settled' }
    );
    if (!(await isEmptyPoolVisible(s, actorId))) {
      await expectPlayReady(s, actorId);
    }
  },
});

const SETTLE_MS = 20_000;
const POLL_MS = 250;

/** Wait until the solver may move: the attempt is live and the board unlocked. */
async function waitSolverCanMove(s: ProductHarness, actorId: string) {
  await pollUntil(
    s,
    async () =>
      (await readPuzzleBoardProbe(s, actorId))?.interactive === true
        ? true
        : null,
    { maxMs: SETTLE_MS, stepMs: POLL_MS, description: 'solver may move' }
  );
}

/** The next move of the line, once the solver may play it. */
async function nextSolutionUci(s: ProductHarness, actorId: string) {
  await waitSolverCanMove(s, actorId);
  const uci = (await readPuzzleDebug(s, actorId))?.solutionUci ?? '';
  if (uci.length < 4) throw new Error(`${actorId} has no next solution move`);
  return uci;
}

/**
 * Narrow the feed to `theme` (a theme only `puzzleId` carries) and wait
 * until that puzzle is on the board and the solver may move.
 */
export const openPuzzleByTheme = scenarioAction({
  name: 'openPuzzleByTheme',
  act: async (
    s,
    actorId: string,
    theme: ChessPuzzleTheme,
    puzzleId: string
  ) => {
    await openFeedSettings(s, actorId);
    await selectFeedTheme(s, actorId, theme);
    await closeFeedSettings(s, actorId);
    await expectPlayReady(s, actorId);
    await pollUntil(
      s,
      async () =>
        (await readActivePuzzleId(s, actorId)) === puzzleId ? true : null,
      { maxMs: SETTLE_MS, stepMs: POLL_MS, description: `puzzle ${puzzleId}` }
    );
    await waitSolverCanMove(s, actorId);
  },
});

/**
 * Castle the way the line expects, entered either as the king's two-square
 * step or as the king dropped onto its own rook.
 */
export const castlePuzzleKing = scenarioAction({
  name: 'castlePuzzleKing',
  act: async (s, actorId: string, entry: 'twoSquares' | 'ontoRook') => {
    const expected = await nextSolutionUci(s, actorId);
    const rookFile = expected[2] === 'g' ? 'h' : 'a';
    const to =
      entry === 'twoSquares'
        ? expected.slice(2, 4)
        : `${rookFile}${expected[3] ?? ''}`;
    await dragPuzzleUci(s, actorId, `${expected.slice(0, 2)}${to}`);
  },
});

/** The host plays the next move of the line and the board moves on. */
export const playNextSolutionMove = scenarioAction({
  name: 'playNextSolutionMove',
  act: async (s, actorId: string) => {
    const uci = await nextSolutionUci(s, actorId);
    const before = await readPuzzleDisplayFen(s, actorId);
    await dragPuzzleUci(s, actorId, uci);
    await pollUntil(
      s,
      async () => {
        const fen = await readPuzzleDisplayFen(s, actorId);
        return fen !== null && fen !== before ? true : null;
      },
      { maxMs: SETTLE_MS, stepMs: POLL_MS, description: 'the board to move' }
    );
  },
});

/** A watcher suggests a legal move that is not the host's next move. */
export const suggestNonSolutionMove = scenarioAction({
  name: 'suggestNonSolutionMove',
  act: async (s, actorId: string) => {
    const solution = (await readPuzzleDebug(s, actorId))?.solutionUci ?? '';
    const fen = await readPuzzleDisplayFen(s, actorId);
    if (fen === null) throw new Error(`${actorId} sees no board`);
    const uci = pickWrongUci(fen, solution);
    await dragSuggestedMove(
      s,
      actorId,
      uci.slice(0, 2) as Square,
      uci.slice(2, 4) as Square
    );
  },
});

/** Solve `count` puzzles one after another, moving on between them. */
export const solvePuzzlesInARow = scenarioAction({
  name: 'solvePuzzlesInARow',
  act: async (s, actorId: string, count: number) => {
    for (let i = 0; i < count; i += 1) {
      await solvePuzzle(s, actorId);
      if (i < count - 1) {
        await tapPuzzleNext(s, actorId);
        await settleAfterPuzzleNext(s, actorId);
      }
    }
  },
});

/**
 * Play `solved` puzzles to a solve, then `failed` puzzles to a fail (a wrong
 * move, then a skip), moving on after each one.
 */
export const playPuzzleResults = scenarioAction({
  name: 'playPuzzleResults',
  act: async (s, actorId: string, solved: number, failed: number) => {
    for (let i = 0; i < solved + failed; i += 1) {
      if (i < solved) {
        await solvePuzzle(s, actorId);
      } else {
        await playWrongMove(s, actorId);
        await tapPuzzleSkip(s, actorId);
      }
      await tapPuzzleNext(s, actorId);
      await settleAfterPuzzleNext(s, actorId);
    }
  },
});

/** Ways a player finishes the puzzle on the board. */
export type PuzzleFinish =
  | 'clean'
  | 'hintThenSolve'
  | 'wrongRetrySolve'
  | 'showSolution'
  | 'skip';

/** Finish the puzzle on the board the way `finish` names. */
export const finishPuzzleBy = scenarioAction({
  name: 'finishPuzzleBy',
  act: async (s, actorId: string, finish: PuzzleFinish) => {
    if (finish === 'hintThenSolve') {
      await pressPuzzleHint(s, actorId);
      await waitPuzzleHintStage(s, actorId, 'highlight');
    }
    if (finish === 'wrongRetrySolve') {
      await playWrongMove(s, actorId);
      await pressPuzzleRetry(s, actorId);
      await waitSolverCanMove(s, actorId);
    }
    if (finish === 'showSolution') {
      await showPuzzleSolution(s, actorId);
    } else if (finish === 'skip') {
      await tapPuzzleSkip(s, actorId);
    } else {
      await solvePuzzle(s, actorId);
    }
  },
});

/**
 * The night passes: every device and the server sleep until the next UTC
 * midnight (when the day's puzzle allowance resets), and whatever fell due
 * meanwhile runs once on waking.
 */
export const sleepUntilNextUtcDay = scenarioAction({
  name: 'sleepUntilNextUtcDay',
  act: async (s) => {
    await s.session.advanceTime(0);
    await s.session.scheduler.underlying.sleep(readMsUntilNextUtcDay(s));
    await s.session.advanceTime(0);
  },
});

/**
 * `perDay` puzzles solved one after another on each of `days` days, the
 * night between days slept through, moving on after every solve.
 */
export const solvePuzzlesDaily = scenarioAction({
  name: 'solvePuzzlesDaily',
  act: async (s, actorId: string, perDay: number, days: number) => {
    for (let day = 0; day < days; day += 1) {
      if (day > 0) {
        await Promise.resolve(sleepUntilNextUtcDay.act(s));
        await tapPuzzleNext(s, actorId);
        await settleAfterPuzzleNext(s, actorId);
      }
      await Promise.resolve(solvePuzzlesInARow.act(s, actorId, perDay));
    }
  },
});

/** Registered on every system that composes this sub. */
export const CHESS_HARNESS_ACTIONS = [
  listenToTheApp,
  playPuzzleMoveWithKeyboard,
  usePuzzleControlWithKeyboard,
  openPuzzleFromSpace,
  openPuzzleFromSpaceNoWait,
  playUntilSolved,
  playPuzzleMove,
  tapPuzzleMove,
  pickUpPuzzlePiece,
  choosePuzzlePromotion,
  showPuzzleSolutionLine,
  setPuzzleAutoAdvance,
  pressPuzzleNextTwice,
  reopenPuzzleFromChessMenu,
  returnToPuzzleScreen,
  pressPuzzleNext,
  pressPuzzleNextNoWait,
  pressPuzzleNextIfVisible,
  playWrongPuzzleMove,
  retryPuzzle,
  requestPuzzleHint,
  revealPuzzleSolution,
  leaveChessStatsScreen,
  leavePuzzleToChessMenu,
  leaveChessMenuToGameMenu,
  openChessStatsScreen,
  openPuzzleReview,
  pressPuzzleReviewNav,
  pressPuzzleReviewArrow,
  tapPuzzleReviewMove,
  swipePuzzleReview,
  includePlayedPuzzles,
  skipPuzzle,
  suggestPuzzleMove,
  openPuzzleFeedSettings,
  closePuzzleFeedSettings,
  closePuzzleFeedSettingsNoWait,
  setPuzzleFeedHistory,
  setPuzzleFeedMode,
  setPuzzleFeedTheme,
  bumpPuzzleFeedOffset,
  bumpPuzzleFeedCustomRating,
  lowerPuzzleFeedOffset,
  lowerPuzzleFeedCustomRating,
  savePuzzleFeedSettings,
  openPuzzleByTheme,
  castlePuzzleKing,
  playNextSolutionMove,
  suggestNonSolutionMove,
  solvePuzzlesInARow,
  playPuzzleResults,
  finishPuzzleBy,
  showChessStatsScreen,
  sleepUntilNextUtcDay,
  solvePuzzlesDaily,
];
