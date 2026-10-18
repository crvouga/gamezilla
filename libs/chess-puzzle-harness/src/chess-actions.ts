import type { ChessPuzzleTheme } from '@libs/chess-puzzle-shared/chess-puzzle-themes';
import {
  isEmptyFeedShown,
  moveOnToNextPuzzle,
  pressEmptyFeedAction,
  readPuzzleBoardPosition,
  readPuzzleOnBoard,
  readPuzzleProbe,
  retryGamePuzzle,
  showPuzzleSolution,
  skipGamePuzzle,
  takePuzzleHint,
  waitNextPuzzle,
} from '@libs/game-session-harness/puzzle-screen';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { openSettings } from '@libs/harness/shell-actions';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import type { FeedHistoryFilter, FeedMode } from './chess-puzzle-feed-ui';
import {
  closeFeedSettings,
  decreaseFeedCustomRating,
  decreaseFeedOffset,
  increaseFeedCustomRating,
  increaseFeedOffset,
  openFeedSettings,
  selectFeedHistory,
  selectFeedMode,
  selectFeedTheme,
} from './chess-puzzle-feed-ui';
import { readMsUntilNextUtcDay } from './chess-puzzle-ledger-data';
import {
  dragPuzzleUci,
  pickPuzzlePromotion,
  pickUpPuzzlePieceAt,
  readPuzzleBoardProbe,
  tapPuzzleUci,
} from './chess-puzzle-solve-ui';
import {
  suggestPuzzleMove as dragSuggestedMove,
  expectPlayReady,
  pickWrongUci,
  playWrongMove,
  solvePuzzle,
} from './chess-puzzle-ui';
import {
  listenToTheApp,
  playPuzzleMoveWithKeyboard,
  usePuzzleControlWithKeyboard,
} from './puzzle-keyboard';

export const playUntilSolved = scenarioAction({
  name: 'playUntilSolved',
  act: solvePuzzle,
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

/** A spectator drags a legal move; the room records it as a suggestion. */
export const suggestPuzzleMove = scenarioAction({
  name: 'suggestPuzzleMove',
  act: dragSuggestedMove,
});

/** Personal progress is reachable from the shell even without a live space. */
export const showPersonalChessStatsScreen = scenarioAction({
  name: 'showPersonalChessStatsScreen',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    if (await ui.get('chess-stats-elo').isVisible()) return;
    await Promise.resolve(openSettings.act(s, actor));
    await ui.get('settings-chess-stats').tap();
    await ui.get('chess-stats-elo').expect.visible();
  },
});

/** Exhausted-feed block primary action, then wait for a placed puzzle. */
export const includePlayedPuzzles = scenarioAction({
  name: 'includePlayedPuzzles',
  act: async (s, actorId: string) => {
    await pressEmptyFeedAction(s, actorId);
    await waitNextPuzzle(s, actorId);
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
        (await isEmptyFeedShown(s, actorId)) ||
        (await readPuzzleOnBoard(s, actorId)) !== null
          ? true
          : null,
      { maxMs: SETTLE_MS, stepMs: POLL_MS, description: 'feed settled' }
    );
    if (!(await isEmptyFeedShown(s, actorId))) {
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
  const uci = (await readPuzzleProbe(s, actorId))?.next ?? '';
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
        (await readPuzzleOnBoard(s, actorId)) === puzzleId ? true : null,
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
    const before = await readPuzzleBoardPosition(s, actorId);
    await dragPuzzleUci(s, actorId, uci);
    await pollUntil(
      s,
      async () => {
        const fen = await readPuzzleBoardPosition(s, actorId);
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
    const solution = (await readPuzzleProbe(s, actorId))?.next ?? '';
    const fen = await readPuzzleBoardPosition(s, actorId);
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
        await Promise.resolve(moveOnToNextPuzzle.act(s, actorId));
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
        await Promise.resolve(skipGamePuzzle.act(s, actorId));
      }
      await Promise.resolve(moveOnToNextPuzzle.act(s, actorId));
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
    if (finish === 'hintThenSolve')
      await Promise.resolve(takePuzzleHint.act(s, actorId));
    if (finish === 'wrongRetrySolve') {
      await playWrongMove(s, actorId);
      await Promise.resolve(retryGamePuzzle.act(s, actorId));
      await waitSolverCanMove(s, actorId);
    }
    if (finish === 'showSolution') {
      await Promise.resolve(showPuzzleSolution.act(s, actorId));
    } else if (finish === 'skip') {
      await Promise.resolve(skipGamePuzzle.act(s, actorId));
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
        await Promise.resolve(moveOnToNextPuzzle.act(s, actorId));
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
  playUntilSolved,
  playPuzzleMove,
  tapPuzzleMove,
  pickUpPuzzlePiece,
  choosePuzzlePromotion,
  playWrongPuzzleMove,
  includePlayedPuzzles,
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
  showPersonalChessStatsScreen,
  sleepUntilNextUtcDay,
  solvePuzzlesDaily,
];
