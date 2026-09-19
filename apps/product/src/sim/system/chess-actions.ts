import { scenarioAction } from './actor-ui';
import {
  closeFeedSettings,
  type FeedAutoAdvance,
  type FeedHistoryFilter,
  type FeedMode,
  increaseFeedCustomRating,
  increaseFeedOffset,
  openFeedSettings,
  selectFeedAutoAdvance,
  selectFeedHistory,
  selectFeedMode,
  selectFeedTheme,
} from './chess-puzzle-feed-ui';
import {
  dragPuzzleUci,
  pickPuzzlePromotion,
  showPuzzleSolution,
  tapPuzzleUci,
} from './chess-puzzle-solve-ui';
import {
  suggestPuzzleMove as dragSuggestedMove,
  expectPlayReady,
  openChessStats,
  openPuzzleFromChessMenu,
  openPuzzlePlay,
  openReviewFromGameLog,
  playWrongMove,
  pressPuzzleBackToChessMenu,
  pressPuzzleHint,
  pressPuzzleRetry,
  pressPuzzleSolution,
  settleAfterPuzzleNext,
  solvePuzzle,
  tapEmptyPoolPrimaryAction,
  pressPuzzleNext as tapPuzzleNext,
  skipPuzzle as tapPuzzleSkip,
  pressPuzzleSummaryNext as tapPuzzleSummaryNext,
  waitPuzzleHintStage,
} from './chess-puzzle-ui';

export const openPuzzleFromSpace = scenarioAction({
  name: 'openPuzzleFromSpace',
  act: openPuzzlePlay,
});

/** Back on the board from the chess main menu (a pending attempt is restored). */
export const reopenPuzzleFromChessMenu = scenarioAction({
  name: 'reopenPuzzleFromChessMenu',
  act: openPuzzleFromChessMenu,
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
 * Both "Next puzzle" surfaces pressed back to back (§34 fast double input):
 * the result panel's CTA and the action bar's button. The second press is
 * best-effort — by then the chrome may already be gone.
 */
export const pressPuzzleNextTwice = scenarioAction({
  name: 'pressPuzzleNextTwice',
  act: async (s, actorId: string) => {
    await tapPuzzleSummaryNext(s, actorId);
    try {
      await tapPuzzleNext(s, actorId);
    } catch {
      // The action bar already moved on; one advance is the point.
    }
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

/** Reveal the full solution arrow (Hint again while highlighted, or Solution). */
export const revealPuzzleSolution = scenarioAction({
  name: 'revealPuzzleSolution',
  act: async (s, actorId: string, via: 'hint' | 'solution' = 'hint') => {
    if (via === 'solution') {
      await pressPuzzleSolution(s, actorId);
    } else {
      await pressPuzzleHint(s, actorId);
    }
    await waitPuzzleHintStage(s, actorId, 'solution');
  },
});

/** Chrome back arrow from play → chess main menu (forfeits an open attempt). */
export const leavePuzzleToChessMenu = scenarioAction({
  name: 'leavePuzzleToChessMenu',
  act: pressPuzzleBackToChessMenu,
});

export const openChessStatsScreen = scenarioAction({
  name: 'openChessStatsScreen',
  act: openChessStats,
});

export const openPuzzleReview = scenarioAction({
  name: 'openPuzzleReview',
  act: openReviewFromGameLog,
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
