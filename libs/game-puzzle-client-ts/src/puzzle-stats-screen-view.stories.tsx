import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PuzzleStatsScreenView } from './puzzle-stats-screen-view';
import {
  PUZZLE_STATS_STORY_ARGS,
  PUZZLE_STATS_STORY_CONTROLS_EXCLUDE,
  STORY_NO_STATS,
  STORY_STATS,
} from './puzzle-stats-story.example';

/** The stats' `summary` place: the rating and the totals at one glance. */
const meta = {
  id: 'screens-puzzles-stats',
  title: 'Screens/Puzzles/Stats/Summary',
  component: PuzzleStatsScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: [...PUZZLE_STATS_STORY_CONTROLS_EXCLUDE] },
  },
  args: PUZZLE_STATS_STORY_ARGS,
} satisfies Meta<typeof PuzzleStatsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A player with history: rating, played, solved and accuracy together. */
export const Populated: Story = {};

/** Who the player is is not known yet; one activity indicator, no figures. */
export const Loading: Story = { args: { stage: 'loading', gameLog: [] } };

/** No puzzle played yet: the provisional starting rating and zero totals. */
export const Empty: Story = { args: { stats: STORY_NO_STATS, gameLog: [] } };

/** A rating still too uncertain to show plainly carries its "?" marker. */
export const Provisional: Story = {
  args: { stats: { ...STORY_STATS, provisional: true } },
};

/** A long history: the totals stay one strip of figures. */
export const LongHistory: Story = {
  args: {
    stats: { ...STORY_STATS, totalPlayed: 120, totalSolved: 97, accuracy: 81 },
  },
};

/** Inside the personal stats route: no title of its own, the host scrolls. */
export const Nested: Story = { args: { titled: false, nested: true } };

/** The trend row opens the rating over time. */
export const OpenTrend: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('chess-stats-open-trend'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'trend' });
  },
};

/** The log row opens every puzzle played. */
export const OpenLog: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('chess-stats-open-log'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'log' });
  },
};
