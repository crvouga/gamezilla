import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PuzzlePlayScreenView } from './puzzle-play-screen-view';
import {
  PUZZLE_PLAY_STORY_ARGS,
  PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE,
  renderPuzzlePlayScene,
  STORY_FEED,
  STORY_FEED_CONFIG,
  StoryPuzzleBoard,
} from './puzzle-screen-story.example';

/**
 * The feed's `feed-history` place: which puzzles the feed draws from, by
 * whether the player has played them.
 */
const meta = {
  id: 'screens-puzzles-play-feed-history',
  title: 'Screens/Puzzles/Play/Feed history',
  component: PuzzlePlayScreenView,
  tags: ['autodocs'],
  render: (args, context) =>
    renderPuzzlePlayScene(args, context, StoryPuzzleBoard),
  parameters: {
    appRouter: true,
    controls: { exclude: [...PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE] },
  },
  args: { ...PUZZLE_PLAY_STORY_ARGS, place: { screen: 'feed-history' } },
} satisfies Meta<typeof PuzzlePlayScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new player's choice: only puzzles never played. */
export const Unseen: Story = {};

/** Only failed puzzles, to try them again. */
export const Failed: Story = {
  args: {
    feed: {
      ...STORY_FEED,
      draft: { ...STORY_FEED_CONFIG, historyFilter: 'failed' },
    },
  },
};

/** Pressing a choice sets it and returns to the settings. */
export const ChooseSeen: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-puzzle-feed-history-seen')
    );
    await expect(args.feed.onChange).toHaveBeenCalledWith({
      historyFilter: 'seen',
    });
    await expect(args.onBack).toHaveBeenCalled();
    await expect(
      await canvas.findByTestId('chess-puzzle-feed-row-history')
    ).toHaveTextContent('Seen');
  },
};
