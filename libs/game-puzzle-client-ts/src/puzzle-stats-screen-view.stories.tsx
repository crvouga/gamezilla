import type {
  PuzzleGameLogEntry,
  PuzzleStats,
} from '@libs/game-puzzle-shared-ts/stats';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PuzzleStatsScreenView } from './puzzle-stats-screen-view';

function entry(
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

const LOG: readonly PuzzleGameLogEntry[] = [
  entry(6, 'solved', { before: 1512, delta: 9 }),
  entry(5, 'failed', { before: 1530, delta: -18 }),
  entry(4, 'solved', { before: 1518, delta: 12 }),
  entry(3, 'abandoned', { before: 1518, delta: 0, rated: false }),
  entry(2, 'solved', { before: 1507, delta: 11 }),
  entry(1, 'failed', { before: 1520, delta: -13 }),
];

const STATS: PuzzleStats = {
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

const NO_STATS: PuzzleStats = {
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

const meta = {
  id: 'screens-puzzles-stats',
  title: 'Screens/Puzzles/Stats',
  component: PuzzleStatsScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['stats', 'gameLog'] },
  },
  args: {
    status: 'ready',
    stats: STATS,
    gameLog: LOG,
    onSelectEntry: fn(),
  },
} satisfies Meta<typeof PuzzleStatsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A player with history: rating, trend, totals and the game log. */
export const Populated: Story = {};

/** Who the player is is not known yet; one activity indicator, no figures. */
export const Loading: Story = { args: { status: 'loading', gameLog: [] } };

/** No puzzle played yet: the provisional starting rating and an empty log. */
export const Empty: Story = { args: { stats: NO_STATS, gameLog: [] } };

/** A rating still too uncertain to show plainly carries its "?" marker. */
export const Provisional: Story = {
  args: { stats: { ...STATS, provisional: true } },
};

/** A long log: the rating history keeps only the latest ten rated puzzles. */
export const LongHistory: Story = {
  args: {
    stats: { ...STATS, totalPlayed: 120, totalSolved: 97, accuracy: 81 },
    gameLog: Array.from({ length: 18 }, (_, index) =>
      entry(index + 10, index % 3 === 0 ? 'failed' : 'solved', {
        before: 1600,
        delta: 7,
      })
    ),
  },
};

/** Inside the personal stats route: no title of its own, the host scrolls. */
export const Nested: Story = { args: { titled: false, nested: true } };

/** Pressing a logged puzzle asks to review that puzzle. */
export const OpenEntry: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-game-log-row-chess:00005')
    );
    await expect(args.onSelectEntry).toHaveBeenCalledWith(LOG[1]);
  },
};
