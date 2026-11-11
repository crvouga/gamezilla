import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PuzzleStatsScreenView } from './puzzle-stats-screen-view';
import {
  PUZZLE_STATS_STORY_ARGS,
  PUZZLE_STATS_STORY_CONTROLS_EXCLUDE,
  STORY_LOG,
  STORY_LONG_LOG,
  STORY_NO_STATS,
} from './puzzle-stats-story.example';

/** The stats' `log` place: every puzzle played, each opening its review. */
const meta = {
  id: 'screens-puzzles-stats-log',
  title: 'Screens/Puzzles/Stats/Log',
  component: PuzzleStatsScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: [...PUZZLE_STATS_STORY_CONTROLS_EXCLUDE] },
  },
  args: { ...PUZZLE_STATS_STORY_ARGS, place: { screen: 'log' } },
} satisfies Meta<typeof PuzzleStatsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Solved, failed and abandoned puzzles, newest first, with their changes. */
export const Populated: Story = {};

/** No puzzle played yet: the log says so, and what fills it. */
export const Empty: Story = { args: { stats: STORY_NO_STATS, gameLog: [] } };

/** A long log scrolls as one panel of rows. */
export const LongLog: Story = { args: { gameLog: STORY_LONG_LOG } };

/** Inside the personal stats route: no title of its own, the host scrolls. */
export const Nested: Story = { args: { titled: false, nested: true } };

/** Pressing a logged puzzle asks to review that puzzle. */
export const OpenEntry: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-game-log-row-chess:00005')
    );
    await expect(args.onSelectEntry).toHaveBeenCalledWith(STORY_LOG[1]);
  },
};
