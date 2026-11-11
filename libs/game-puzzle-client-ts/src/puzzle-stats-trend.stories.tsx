import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PuzzleStatsScreenView } from './puzzle-stats-screen-view';
import {
  PUZZLE_STATS_STORY_ARGS,
  PUZZLE_STATS_STORY_CONTROLS_EXCLUDE,
  STORY_LONG_LOG,
  STORY_NO_STATS,
} from './puzzle-stats-story.example';

/** The stats' `trend` place: the rating over time. */
const meta = {
  id: 'screens-puzzles-stats-trend',
  title: 'Screens/Puzzles/Stats/Trend',
  component: PuzzleStatsScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: [...PUZZLE_STATS_STORY_CONTROLS_EXCLUDE] },
  },
  args: { ...PUZZLE_STATS_STORY_ARGS, place: { screen: 'trend' } },
} satisfies Meta<typeof PuzzleStatsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The rating drawn, and after each of the latest rated puzzles. */
export const Populated: Story = {};

/** Nothing rated yet: the trend says so, and what starts it. */
export const Empty: Story = { args: { stats: STORY_NO_STATS, gameLog: [] } };

/** A long history: only the latest ten rated puzzles are listed. */
export const LongHistory: Story = { args: { gameLog: STORY_LONG_LOG } };

/** Inside the personal stats route: no title of its own, the host scrolls. */
export const Nested: Story = { args: { titled: false, nested: true } };
