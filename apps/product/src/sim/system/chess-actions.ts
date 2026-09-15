import { scenarioAction } from './actor-ui';
import {
  closeFeedSettings,
  type FeedHistoryFilter,
  type FeedMode,
  increaseFeedCustomRating,
  increaseFeedOffset,
  openFeedSettings,
  selectFeedHistory,
  selectFeedMode,
} from './chess-puzzle-feed-ui';
import {
  expectPlayReady,
  openChessStats,
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
  waitPuzzleHintStage,
} from './chess-puzzle-ui';

export const openPuzzleFromSpace = scenarioAction({
  name: 'openPuzzleFromSpace',
  act: openPuzzlePlay,
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

export const retryPuzzle = scenarioAction({
  name: 'retryPuzzle',
  act: pressPuzzleRetry,
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
