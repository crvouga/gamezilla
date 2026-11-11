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

/** The feed's `feed-target` place: the rating the feed aims at. */
const meta = {
  id: 'screens-puzzles-play-feed-target',
  title: 'Screens/Puzzles/Play/Feed target',
  component: PuzzlePlayScreenView,
  tags: ['autodocs'],
  render: (args, context) =>
    renderPuzzlePlayScene(args, context, StoryPuzzleBoard),
  parameters: {
    appRouter: true,
    controls: { exclude: [...PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE] },
  },
  args: { ...PUZZLE_PLAY_STORY_ARGS, place: { screen: 'feed-target' } },
} satisfies Meta<typeof PuzzlePlayScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Automatic: the player's rating, with no offset. */
export const Automatic: Story = {};

/** Automatic with the offset at its upper limit: no further step up. */
export const AutomaticAtTheLimit: Story = {
  args: {
    feed: {
      ...STORY_FEED,
      draft: { ...STORY_FEED_CONFIG, autoOffset: 400 },
      draftTarget: 1900,
    },
  },
};

/** Custom: a fixed rating, whatever the player's own. */
export const Custom: Story = {
  args: {
    feed: {
      ...STORY_FEED,
      draft: { ...STORY_FEED_CONFIG, mode: 'custom', customRating: 1850 },
      draftTarget: 1850,
    },
  },
};

/** A new player's own rating is not known yet. */
export const RatingUnknown: Story = {
  args: { feed: { ...STORY_FEED, profileRating: 0 } },
};

/** Raising the offset previews the target it makes, before anything is saved. */
export const RaiseOffset: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-puzzle-feed-offset-increase')
    );
    await expect(args.feed.onChange).toHaveBeenCalledWith({ autoOffset: 50 });
    await expect(
      await canvas.findByTestId('chess-puzzle-feed-target')
    ).toHaveTextContent('1550');
  },
};

/** Choosing Custom swaps the offset for the fixed rating's stepper. */
export const ChooseCustom: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-puzzle-feed-mode-custom')
    );
    await expect(args.feed.onChange).toHaveBeenCalledWith({ mode: 'custom' });
    await expect(
      await canvas.findByTestId('chess-puzzle-feed-custom-rating-value')
    ).toBeVisible();
  },
};
