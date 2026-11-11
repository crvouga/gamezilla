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

/** The feed's `feed-advance` place: what happens after a solve. */
const meta = {
  id: 'screens-puzzles-play-feed-advance',
  title: 'Screens/Puzzles/Play/Feed advance',
  component: PuzzlePlayScreenView,
  tags: ['autodocs'],
  render: (args, context) =>
    renderPuzzlePlayScene(args, context, StoryPuzzleBoard),
  parameters: {
    appRouter: true,
    controls: { exclude: [...PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE] },
  },
  args: { ...PUZZLE_PLAY_STORY_ARGS, place: { screen: 'feed-advance' } },
} satisfies Meta<typeof PuzzlePlayScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new player's choice: the next puzzle starts when asked for. */
export const WaitForMe: Story = {};

/** A solve moves on at once. */
export const Immediately: Story = {
  args: {
    feed: {
      ...STORY_FEED,
      draft: { ...STORY_FEED_CONFIG, autoAdvance: 'immediate' },
    },
  },
};

/** Pressing a choice sets it and returns to the settings. */
export const ChooseAfterOneSecond: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-puzzle-feed-auto-advance-after1s')
    );
    await expect(args.feed.onChange).toHaveBeenCalledWith({
      autoAdvance: 'after1s',
    });
    await expect(args.onBack).toHaveBeenCalled();
    await expect(
      await canvas.findByTestId('chess-puzzle-feed-row-advance')
    ).toHaveTextContent('Next after 1 s');
  },
};
