/**
 * Story-only fixtures for the puzzle stats' screens: a player's totals and
 * game log. Production never imports this module.
 */
import type {
  PuzzleGameLogEntry,
  PuzzleStats,
} from '@libs/game-puzzle-shared-ts/stats';
import { fn } from 'storybook/test';
import type { PuzzleStatsScreenViewProps } from './puzzle-stats-screen-view';

/** One logged puzzle, numbered so its id and rating are stable. */
export function storyLogEntry(
  index: number,
  outcome: PuzzleGameLogEntry['outcome'],
  change: { readonly before: number; readonly delta: number; rated?: boolean }
): PuzzleGameLogEntry {
  return {
    puzzleId: `chess:0000${index}`,
    puzzleRating: 1400 + index * 37,
    outcome,
    ratingBefore: change.before,
    ratingAfter: change.before + change.delta,
    delta: change.delta,
    rated: change.rated ?? true,
    at: `2023-11-14T2${index % 2}:0${index % 10}:00.000Z`,
  };
}

/** Six puzzles: solved, failed, and one abandoned without a rating. */
export const STORY_LOG: readonly PuzzleGameLogEntry[] = [
  storyLogEntry(6, 'solved', { before: 1512, delta: 9 }),
  storyLogEntry(5, 'failed', { before: 1530, delta: -18 }),
  storyLogEntry(4, 'solved', { before: 1518, delta: 12 }),
  storyLogEntry(3, 'abandoned', { before: 1518, delta: 0, rated: false }),
  storyLogEntry(2, 'solved', { before: 1507, delta: 11 }),
  storyLogEntry(1, 'failed', { before: 1520, delta: -13 }),
];

/** A long log: eighteen rated puzzles. */
export const STORY_LONG_LOG: readonly PuzzleGameLogEntry[] = Array.from(
  { length: 18 },
  (_, index) =>
    storyLogEntry(index + 10, index % 3 === 0 ? 'failed' : 'solved', {
      before: 1600,
      delta: 7,
    })
);

export const STORY_STATS: PuzzleStats = {
  currentRating: 1521,
  ratingDeviation: 62,
  provisional: false,
  totalPlayed: 6,
  totalSolved: 3,
  accuracy: 50,
  currentStreak: 1,
  bestStreak: 2,
  ratingSeries: [1500, 1520, 1507, 1518, 1530, 1512, 1521],
};

/** Before any puzzle: the provisional starting rating. */
export const STORY_NO_STATS: PuzzleStats = {
  currentRating: 1500,
  ratingDeviation: 350,
  provisional: true,
  totalPlayed: 0,
  totalSolved: 0,
  accuracy: 0,
  currentStreak: 0,
  bestStreak: 0,
  ratingSeries: [1500],
};

/** The stats of a player with history, on the summary, every callback a spy. */
export const PUZZLE_STATS_STORY_ARGS: PuzzleStatsScreenViewProps = {
  stage: 'ready',
  place: { screen: 'summary' },
  onOpen: fn(),
  stats: STORY_STATS,
  gameLog: STORY_LOG,
  onSelectEntry: fn(),
};

/** The stats' args a story fills itself, hidden from Controls. */
export const PUZZLE_STATS_STORY_CONTROLS_EXCLUDE = [
  'stats',
  'gameLog',
] as const;
